<template>
    <div class="time-grid">
      <!-- STICKY MONTH HEADER -->
      <div class="time-grid-header">
        <div class="header-inner">
          <button class="nav-btn" @click="prevMonth">←</button>
          <h2 class="month-title">{{ currentMonthLabel }}</h2>
          <button class="nav-btn" @click="nextMonth">→</button>
        </div>
      </div>
  
      <!-- HORIZONTAL SCROLL CONTAINER -->
      <div 
        class="scroll-container"
        ref="scrollContainer"
        @mousedown="handleMouseDown"
        @mousemove="handleMouseMove"
        @mouseup="handleMouseUp"
        @mouseleave="handleMouseUp"
      >
        <div v-if="loading" class="loading-state">
          <div class="spinner"></div>
          <p>Loading interviews…</p>
        </div>
  
        <div v-else class="days-wrapper">
          <div
            v-for="day in days"
            :key="day.key"
            class="day-column"
            :class="{ today: day.isToday, 'has-tickets': day.tickets.length > 0 }"
            :ref="el => setDayRef(day.key, el)"
            @dragover.prevent
            @drop="handleDrop(day.key)"
          >
            <!-- COLUMN HEADER -->
            <div class="column-header">
              <div class="column-title-wrapper">
                <h3 class="column-title">{{ day.label }}</h3>
                <span class="column-count">({{ day.tickets.length }})</span>
              </div>
  
              <button
                v-if="canEdit"
                class="btn-add"
                @click="handleAdd(day.key)"
              >
                + Add
              </button>
            </div>
  
            <!-- DAY TIMELINE CONTENT -->
            <div v-if="day.tickets.length > 0" class="day-timeline">
              <!-- Tickets in normal flow -->
              <div class="tickets-container">
                <div
                  v-for="ticket in getSortedTickets(day.tickets)"
                  :key="ticket._id"
                  class="timeline-ticket"
                  draggable="true"
                  @dragstart="handleDragStart(ticket)"
                  @click="$emit('click-ticket', ticket)"
                >
                  <TimeTicketCard 
                    :ticket="ticket" 
                    :users="users" 
                    :can-delete="canEdit"
                    :board-id="boardId"
                    @delete="handleDeleteTicket"
                  />
                </div>
              </div>
            </div>
            
            <!-- Empty state -->
            <div v-else class="empty-day">
              <p>No interviews scheduled</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
  import InterviewTicketCard from './InterviewTicketCard.vue';
  import TimeTicketCard from './TimeTicketCard.vue';
  import * as boardService from '../../services/interviewBoards';
  import { utcToEST, formatESTDateTime, estToUTC } from '../../utils/timezoneHelpers';
  
  const props = defineProps({
    boardId: { type: String, required: true },
    canEdit: { type: Boolean, default: false },
    users: { type: Array, default: () => [] },
    /** When changed, reload time view without scrolling to today (keeps user on current month/date) */
    refreshKey: { type: [Number, String], default: 0 }
  });
  
  const emit = defineEmits([
    'click-ticket',
    'add-ticket-for-day',
    'ticket-moved'
  ]);
  
  /* ---------------- State ---------------- */
  
  const loading = ref(false);
  const days = ref([]);
  const draggedTicket = ref(null);
  const currentDate = ref(new Date());
  const dayRefs = ref({});
  const scrollContainer = ref(null);
  
  // Drag-to-scroll state
  const isDragging = ref(false);
  const startX = ref(0);
  const scrollLeft = ref(0);
  
  // Time slots: 0-23 hours (24 hours)
  const timeSlots = ref(Array.from({ length: 24 }, (_, i) => i));
  
  // Height per hour in pixels (60px = 1 hour)
  const HOUR_HEIGHT = 60;
  const PADDING_TOP = 20; // Top padding for timeline
  const PADDING_BOTTOM = 20; // Bottom padding for timeline
  
  /* ---------------- Date helpers ---------------- */
  
  const startOfMonth = d => new Date(d.getFullYear(), d.getMonth(), 1);
  const endOfMonth = d => new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const toDayKey = d => d.toISOString().slice(0, 10);
  
  const formatDayLabel = d =>
    d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  
  const formatMonthLabel = d =>
    d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  
  const isSameDay = (a, b) => a.toDateString() === b.toDateString();
  
  const formatHour = (hour) => {
    if (hour === 0) return '12 AM';
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return '12 PM';
    return `${hour - 12} PM`;
  };
  
  /* ---------------- Computed ---------------- */
  
  const currentMonthLabel = computed(() =>
    formatMonthLabel(currentDate.value)
  );
  
  /* ---------------- Ticket Positioning ---------------- */
  
  const getTicketTime = (ticket) => {
    // Get primary date or first date
    const primaryIndex = ticket.primaryDateIndex || 0;
    const dateObj = ticket.dates?.[primaryIndex];
    if (!dateObj || !dateObj.scheduledAt) return null;
    
    // Convert UTC to EST for display
    const est = utcToEST(dateObj.scheduledAt);
    if (!est) return null;
    
    const estDate = est.dateTime;
    return {
      hour: estDate.getUTCHours(),
      minute: estDate.getUTCMinutes(),
      duration: dateObj.durationMinutes || 60
    };
  };
  
  const getTicketPosition = (ticket, index, allTickets) => {
    // Stack cards sequentially from top with padding between cards
    const CARD_SPACING = 12; // Space between cards - increased for better visibility
    let topPosition = PADDING_TOP;
    
    // Calculate cumulative top position based on previous cards
    for (let i = 0; i < index; i++) {
      const prevTicket = allTickets[i];
      const prevDuration = prevTicket.dates?.[prevTicket.primaryDateIndex || 0]?.durationMinutes || 60;
      // Calculate actual card height (minimum 60px, or based on duration)
      const prevHeight = Math.max(60, (prevDuration / 60) * HOUR_HEIGHT);
      topPosition += prevHeight + CARD_SPACING;
    }
    
    const duration = ticket.dates?.[ticket.primaryDateIndex || 0]?.durationMinutes || 60;
    const height = Math.max(60, (duration / 60) * HOUR_HEIGHT);
    
    return {
      top: `${topPosition}px`,
      height: `${height}px`
    };
  };
  
  const getVisibleHours = (tickets) => {
    if (!tickets || tickets.length === 0) return [];
    
    // Get unique hours from tickets for time markers
    const hours = new Set();
    tickets.forEach(ticket => {
      const time = getTicketTime(ticket);
      if (time) {
        hours.add(time.hour);
      }
    });
    
    return Array.from(hours).sort((a, b) => a - b);
  };
  
  const getHourPosition = (hour, tickets) => {
    // Find the index of the first ticket at this hour
    const sortedTickets = getSortedTickets(tickets);
    const CARD_SPACING = 10; // Spacing
    let position = PADDING_TOP;
    
    for (let i = 0; i < sortedTickets.length; i++) {
      const ticket = sortedTickets[i];
      const time = getTicketTime(ticket);
      if (time && time.hour === hour) {
        return position;
      }
      // Add height of this card
      const duration = ticket.dates?.[ticket.primaryDateIndex || 0]?.durationMinutes || 60;
      const cardHeight = Math.max(60, (duration / 60) * HOUR_HEIGHT); // Reduced min height
      position += cardHeight + CARD_SPACING;
    }
    
    return PADDING_TOP;
  };
  
  const getDayHeight = (tickets) => {
    // Minimum height when no tickets
    const MIN_HEIGHT = 150;
    
    if (!tickets || tickets.length === 0) {
      return MIN_HEIGHT;
    }
    
    // Calculate height based on stacked cards
    const sortedTickets = getSortedTickets(tickets);
    if (sortedTickets.length === 0) {
      return MIN_HEIGHT;
    }
    
    const CARD_SPACING = 12; // Match spacing in getTicketPosition
    let totalHeight = PADDING_TOP;
    
    // Calculate cumulative height of all cards
    sortedTickets.forEach((ticket, index) => {
      const duration = ticket.dates?.[ticket.primaryDateIndex || 0]?.durationMinutes || 60;
      const cardHeight = Math.max(60, (duration / 60) * HOUR_HEIGHT);
      
      if (index === sortedTickets.length - 1) {
        // Last card: add its full height
        totalHeight += cardHeight;
      } else {
        // Not last card: add height + spacing
        totalHeight += cardHeight + CARD_SPACING;
      }
    });
    
    totalHeight += PADDING_BOTTOM;
    
    // Ensure minimum height
    return Math.max(MIN_HEIGHT, totalHeight);
  };
  
  const getSortedTickets = (tickets) => {
    return [...tickets].sort((a, b) => {
      const timeA = getTicketTime(a);
      const timeB = getTicketTime(b);
      
      if (!timeA && !timeB) return 0;
      if (!timeA) return 1;
      if (!timeB) return -1;
      
      const totalMinutesA = timeA.hour * 60 + timeA.minute;
      const totalMinutesB = timeB.hour * 60 + timeB.minute;
      
      return totalMinutesA - totalMinutesB;
    });
  };
  
  /* ---------------- Refs & Scrolling ---------------- */
  
  const setDayRef = (key, el) => {
    if (el) dayRefs.value[key] = el;
  };
  
  const scrollToToday = async () => {
    await nextTick();
    const todayKey = toDayKey(new Date());
    const el = dayRefs.value[todayKey];
  
    if (el && el.scrollIntoView) {
      el.scrollIntoView({
        inline: 'center',
        block: 'nearest'
      });
    }
  };
  
/* ---------------- Load Time View ---------------- */

  /**
   * @param {Object} opts
   * @param {boolean} opts.showLoading - If true, show full-screen loading (replaces days). If false, keep current view and scroll (for refresh after add/move).
   */
  const loadTimeView = async (opts = {}) => {
    const showLoading = opts.showLoading !== false;
    const isRefresh = !showLoading;

    const savedScrollLeft = scrollContainer.value ? scrollContainer.value.scrollLeft : 0;

    if (showLoading) {
      loading.value = true;
    }

    const start = startOfMonth(currentDate.value);
    const end = endOfMonth(currentDate.value);

    // Request a wider date range to account for timezone differences
    const requestStart = new Date(start);
    requestStart.setDate(requestStart.getDate() - 1);
    const requestEnd = new Date(end);
    requestEnd.setDate(requestEnd.getDate() + 1);

    const response = await boardService.fetchTicketsTimeView(
      props.boardId,
      toDayKey(requestStart),
      toDayKey(requestEnd)
    );

    const rawDays = response.data.days || {};
    const result = [];

    const ticketsByESTDay = {};
    const seenTicketIds = new Set();

    Object.keys(rawDays).forEach(utcDayKey => {
      const tickets = rawDays[utcDayKey] || [];
      tickets.forEach(ticket => {
        const ticketId = ticket._id || ticket.id;
        if (seenTicketIds.has(ticketId)) return;
        seenTicketIds.add(ticketId);

        const primaryIndex = ticket.primaryDateIndex || 0;
        const dateObj = ticket.dates?.[primaryIndex];
        if (dateObj && dateObj.scheduledAt) {
          const est = utcToEST(dateObj.scheduledAt);
          if (est) {
            const estDayKey = est.date;
            if (!ticketsByESTDay[estDayKey]) ticketsByESTDay[estDayKey] = [];
            ticketsByESTDay[estDayKey].push(ticket);
          }
        }
      });
    });

    const cursor = new Date(start);
    while (cursor <= end) {
      const key = toDayKey(cursor);
      result.push({
        key,
        label: formatDayLabel(cursor),
        isToday: isSameDay(cursor, new Date()),
        tickets: ticketsByESTDay[key] || []
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    days.value = result;
    loading.value = false;

    if (isRefresh && scrollContainer.value) {
      await nextTick();
      scrollContainer.value.scrollLeft = savedScrollLeft;
    }
  };
  
  /* ---------------- Actions ---------------- */
  
  const handleAdd = (day) => emit('add-ticket-for-day', day);
  
  const handleDragStart = (ticket) => {
    // Stop any scroll dragging when starting to drag a card
    if (isDragging.value) {
      isDragging.value = false;
      if (scrollContainer.value) {
        scrollContainer.value.classList.remove('dragging');
        scrollContainer.value.style.cursor = 'grab';
        scrollContainer.value.style.userSelect = '';
      }
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    }
    draggedTicket.value = ticket;
  };
  
const handleDrop = async (day) => {
    if (!draggedTicket.value) return;

    const ticket = draggedTicket.value;
    const primaryIndex = ticket.primaryDateIndex ?? 0;
    const dateObj = ticket.dates?.[primaryIndex];

    // Preserve existing time and duration when moving to another day
    const existingTime = getTicketTime(ticket);
    const timeString = existingTime
      ? `${String(existingTime.hour).padStart(2, '0')}:${String(existingTime.minute).padStart(2, '0')}`
      : '09:00';
    const durationMinutes = dateObj?.durationMinutes ?? 60;

    const utcDate = estToUTC(day, timeString);

    await boardService.updateInterviewTicket(
      props.boardId,
      ticket._id,
      {
        dates: [{
          scheduledAt: utcDate,
          durationMinutes
        }]
      }
    );

    draggedTicket.value = null;
    emit('ticket-moved');
    await loadTimeView({ showLoading: false });
  };
  
  const handleDeleteTicket = async (ticket) => {
    if (!confirm(`Are you sure you want to delete this ticket? This action cannot be undone.`)) {
      return;
    }
    
    try {
      const response = await boardService.deleteInterviewTicket(props.boardId, ticket._id);
      if (response.ok) {
        await loadTimeView({ showLoading: false });
        emit('ticket-moved');
      } else {
        alert(response.message || 'Failed to delete ticket');
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to delete ticket');
    }
  };

  /* ---------------- Drag-to-Scroll ---------------- */
  
  const handleMouseDown = (e) => {
    // Don't start drag-to-scroll if clicking on interactive elements
    // Only block if clicking directly on cards or buttons
    const clickedCard = e.target.closest('.time-ticket-card');
    const clickedTicket = e.target.closest('.timeline-ticket');
    const clickedButton = e.target.closest('.btn-add') || e.target.closest('button') || e.target.closest('a');
    
    if (clickedCard || clickedTicket || clickedButton) {
      return;
    }
    
    // Allow drag-to-scroll inside day sections (empty space, day-timeline, tickets-container, empty-day)
    // Cards are already blocked above, so this will work for empty areas
    
    if (!scrollContainer.value) return;
    
    isDragging.value = true;
    startX.value = e.clientX;
    scrollLeft.value = scrollContainer.value.scrollLeft;
    
    scrollContainer.value.classList.add('dragging');
    scrollContainer.value.style.cursor = 'grabbing';
    scrollContainer.value.style.userSelect = 'none';
    
    // Add global listeners for mouse move and up
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    
    e.preventDefault();
    e.stopPropagation();
  };

  const handleMouseMove = (e) => {
    if (!isDragging.value || !scrollContainer.value) return;
    handleGlobalMouseMove(e);
  };

  const handleGlobalMouseMove = (e) => {
    if (!isDragging.value || !scrollContainer.value) return;
    
    e.preventDefault();
    
    const deltaX = e.clientX - startX.value;
    const scrollSpeed = 1.5; // Scroll sensitivity - adjust as needed
    scrollContainer.value.scrollLeft = scrollLeft.value - (deltaX * scrollSpeed);
  };

  const handleMouseUp = (e) => {
    handleGlobalMouseUp(e);
  };

  const handleGlobalMouseUp = (e) => {
    if (!isDragging.value) return;
    
    isDragging.value = false;
    if (scrollContainer.value) {
      scrollContainer.value.classList.remove('dragging');
      scrollContainer.value.style.cursor = 'grab';
      scrollContainer.value.style.userSelect = '';
    }
    
    // Remove global listeners
    document.removeEventListener('mousemove', handleGlobalMouseMove);
    document.removeEventListener('mouseup', handleGlobalMouseUp);
    
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  
  /* ---------------- Month Navigation ---------------- */
  
  const prevMonth = async () => {
    currentDate.value = new Date(
      currentDate.value.getFullYear(),
      currentDate.value.getMonth() - 1,
      1
    );
    await loadTimeView();
  };
  
  const nextMonth = async () => {
    currentDate.value = new Date(
      currentDate.value.getFullYear(),
      currentDate.value.getMonth() + 1,
      1
    );
    await loadTimeView();
  };
  
  const isInitialLoad = ref(true);

  watch(() => props.refreshKey, async () => {
    if (!props.boardId) return;
    await loadTimeView({ showLoading: false });
  });

  onMounted(async () => {
    await loadTimeView();
    if (isInitialLoad.value) {
      isInitialLoad.value = false;
      await nextTick();
      scrollToToday();
    }
  });

  onUnmounted(() => {
    // Clean up global event listeners
    if (isDragging.value) {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      isDragging.value = false;
    }
  });
  </script>
  
  <style scoped>
  /* ===== LAYOUT ===== */
  .time-grid {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
  }
  
  /* ===== STICKY HEADER ===== */
  .time-grid-header {
    position: sticky;
    top: 0;
    z-index: 100;
    background: var(--bg-primary);
    border-bottom: 2px solid var(--border-light);
    padding: 16px 24px;
    margin-bottom: 0;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }
  
  .header-inner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 20px;
    max-width: 1200px;
    margin: 0 auto;
  }
  
  .month-title {
    font-size: 1.3rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }
  
  .nav-btn {
    padding: 8px 16px;
    background: var(--color-primary);
    color: var(--text-inverse);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 500;
    transition: all 0.2s;
    min-width: 44px;
  }

  .nav-btn:hover {
    background: var(--color-primary-dark);
    transform: scale(1.05);
  }
  
  /* ===== SCROLL CONTAINER ===== */
  .scroll-container {
    flex: 1;
    overflow-x: auto;
    overflow-y: auto;
    padding-top: 0;
    padding-bottom: 20px;
    cursor: grab;
    user-select: none;
    -webkit-overflow-scrolling: touch;
  }

  .scroll-container.dragging {
    cursor: grabbing !important;
  }

  .scroll-container:active {
    cursor: grabbing;
  }

  .scroll-container::-webkit-scrollbar {
    width: 8px;
    height: 10px;
  }

  .scroll-container::-webkit-scrollbar-track {
    background: var(--bg-tertiary);
    border-radius: 4px;
  }

  .scroll-container::-webkit-scrollbar-thumb {
    background: var(--border-medium);
    border-radius: 4px;
  }

  .scroll-container::-webkit-scrollbar-thumb:hover {
    background: var(--border-dark);
  }
  
  /* ===== DAYS WRAPPER ===== */
  .days-wrapper {
    display: flex;
    gap: 16px;
    padding: 20px;
    padding-bottom: 150px;
    min-width: fit-content;
  }
  
  /* ===== DAY COLUMNS ===== */
  .day-column {
    min-width: 320px;
    width: 320px;
    background: var(--bg-primary);
    border-radius: 8px;
    border: 1px solid var(--border-light);
    display: flex;
    flex-direction: column;
    transition: all 0.2s;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    flex-shrink: 0;
  }

  .day-column:hover {
    box-shadow: var(--shadow-md);
    border-color: var(--border-medium);
  }
  
  .day-column.today {
    border-color: var(--color-success);
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.2);
  }
  
  /* ===== COLUMN HEADER ===== */
  .column-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: var(--bg-tertiary);
    border-bottom: 2px solid var(--border-light);
    flex-shrink: 0;
  }
  
  .column-title-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .column-title {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }
  
  .column-count {
    font-size: 0.75rem;
    color: var(--text-secondary);
    background: var(--bg-primary);
    padding: 2px 8px;
    border-radius: 12px;
    font-weight: 500;
  }
  
  /* ===== DAY TIMELINE ===== */
  .day-timeline {
    flex: 1;
    min-height: 150px;
    padding: 20px;
  }

  /* Tickets container */
  .tickets-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .timeline-ticket {
    width: 100%;
    box-sizing: border-box;
  }

  /* Empty day state */
  .empty-day {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    min-height: 150px;
    color: var(--text-tertiary);
    font-size: 0.9rem;
  }
  
  /* ===== BUTTONS ===== */
  .btn-add {
    padding: 6px 12px;
    background: var(--color-success);
    color: var(--text-inverse);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 500;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .btn-add:hover {
    background: var(--color-success-dark);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }

  /* ===== LOADING STATE ===== */
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    gap: 16px;
  }

  .loading-state p {
    color: var(--text-secondary);
    font-size: 0.95rem;
  }

  .spinner {
    border: 3px solid var(--bg-tertiary);
    border-top: 3px solid var(--color-primary);
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  </style>
  