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

        <!-- SCROLLABLE DAY COLUMNS -->
        <div class="grid-scroll">
            <div v-if="loading" class="loading-state">
                <div class="spinner"></div>
                <p>Loading interviews…</p>
            </div>

            <div v-else class="grid-wrapper">
                <div v-for="day in days" :key="day.key" class="day-column" :class="{ today: day.isToday }"
                    @dragover.prevent @drop="handleDrop(day.key)">
                    <!-- COLUMN HEADER (LIKE STAGE VIEW) -->
                    <div class="column-header">
                        <div class="column-title-wrapper">
                            <h3 class="column-title">{{ day.label }}</h3>
                            <span class="column-count">({{ day.tickets.length }})</span>
                        </div>

                        <button v-if="canEdit" class="btn-add" @click="handleAdd(day.key)">
                            + Add card
                        </button>
                    </div>

                    <div class="column-divider"></div>

                    <!-- COLUMN CONTENT -->
                    <div class="column-content">
                        <InterviewTicketCard v-for="ticket in day.tickets" :key="ticket._id" :ticket="ticket"
                            draggable="true" @dragstart="handleDragStart(ticket)"
                            @click="$emit('click-ticket', ticket)" />

                        <div v-if="day.tickets.length === 0" class="empty-column">
                            No interviews
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import InterviewTicketCard from './InterviewTicketCard.vue';
import * as boardService from '../../services/interviewBoards';

const props = defineProps({
    boardId: { type: String, required: true },
    canEdit: { type: Boolean, default: false }
});

const emit = defineEmits([
    'click-ticket',
    'add-ticket-for-day',
    'ticket-moved'
]);

const loading = ref(false);
const days = ref([]);
const draggedTicket = ref(null);
const currentDate = ref(new Date());

/* -------- Date helpers -------- */

const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const toDayKey = (d) => d.toISOString().slice(0, 10);

const formatDayLabel = (d) =>
    d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });

const formatMonthLabel = (d) =>
    d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

const isSameDay = (a, b) => a.toDateString() === b.toDateString();

const currentMonthLabel = computed(() => formatMonthLabel(currentDate.value));

/* -------- Load data -------- */

const loadTimeView = async () => {
    loading.value = true;

    const start = startOfMonth(currentDate.value);
    const end = endOfMonth(currentDate.value);

    const response = await boardService.fetchTicketsTimeView(
        props.boardId,
        toDayKey(start),
        toDayKey(end)
    );

    const rawDays = response.data.days || {};
    const result = [];

    const cursor = new Date(start);
    while (cursor <= end) {
        const key = toDayKey(cursor);
        result.push({
            key,
            label: formatDayLabel(cursor),
            isToday: isSameDay(cursor, new Date()),
            tickets: rawDays[key] || []
        });
        cursor.setDate(cursor.getDate() + 1);
    }

    days.value = result;
    loading.value = false;
};

/* -------- Actions -------- */

const handleAdd = (day) => emit('add-ticket-for-day', day);

const handleDragStart = (ticket) => {
    draggedTicket.value = ticket;
};

const handleDrop = async (day) => {
    if (!draggedTicket.value) return;

    await boardService.updateInterviewTicket(
        props.boardId,
        draggedTicket.value._id,
        {
            dates: [{ scheduledAt: `${day}T09:00:00.000Z`, durationMinutes: 60 }]
        }
    );

    draggedTicket.value = null;
    emit('ticket-moved');
    await loadTimeView();
};

/* -------- Navigation -------- */

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

onMounted(loadTimeView);
</script>

<style scoped>
/* ===== LAYOUT ===== */
.time-grid {
    height: 100%;
    display: flex;
    flex-direction: column;
}

.grid-scroll {
    overflow-x: auto;
    overflow-y: hidden;
}

/* ===== HEADER ===== */
.time-grid-header {
    position: sticky;
    top: 0;
    z-index: 50;
    background: #fff;
    border: 1px solid rgb(52, 152, 219);
    padding: 8px 0;
    width: 50%;
    margin: auto;
    border-radius: 20px;
    margin-bottom: 50px;
    margin-top: 20px;
    /* border-top: 3px solid rgb(52, 152, 219); */
}

.header-inner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
}

.month-title {
    font-size: 18px;
    font-weight: 600;
}

/* ===== COLUMNS ===== */
.grid-wrapper {
    display: flex;
    gap: 16px;
    padding: 12px;
}

.day-column {
    min-width: 260px;
    background: #ffffff;
    border-radius: 10px;
    padding: 10px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    border-top: 3px solid rgb(52, 152, 219);
    min-height: 450px;
}

.day-column.today {
    border: 2px solid #3b82f6;
}

/* ===== COLUMN HEADER (MATCH STAGE VIEW) ===== */
.column-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.column-title-wrapper {
    display: flex;
    align-items: center;
    gap: 6px;
}

.column-title {
    font-size: 14px;
    font-weight: 600;
}

.column-count {
    font-size: 12px;
    color: #6b7280;
}

.column-divider {
    margin: 8px 0;
    border-bottom: 1px solid #e5e7eb;
}

/* ===== CONTENT ===== */
.column-content {
    min-height: 140px;
}

.empty-column {
    margin-top: 32px;
    text-align: center;
    font-size: 13px;
    color: #9ca3af;
}

/* ===== BUTTONS ===== */
.btn-add {
    font-size: 12px;
    padding: 2px 6px;
    background: #27ae60;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.95rem;
    font-weight: 500;
    transition: background 0.2s;
}
</style>
