<script setup>
import { ref, watch, computed, onMounted } from 'vue'
import apiClient from '../services/axios'
import FinanceMetricCard from '../components/finance/financeOverview/FinanceMetricCard.vue'
import FinancePieChart from '../components/finance/financeOverview/FinancePieChart.vue'
import FinanceRankingChart from '../components/finance/financeOverview/FinanceRankingChart.vue'
import CircularProgressGauge from '../components/finance/financeOverview/CircularProgressGauge.vue'
import MiniDoughnutChart from '../components/finance/financeOverview/MiniDoughnutChart.vue'
import MiniBarChart from '../components/finance/financeOverview/MiniBarChart.vue'
import FlowerShower from '../components/finance/financeOverview/FlowerShower.vue'
import { formatMonth } from '../utils/financeHelpers'
import * as financeService from '../services/finance'
import { fetchGroups } from '../services/admin'
import { getESTMonthKey } from '../utils/timezoneHelpers'
import { monthRangeKeys } from '../utils/businessMonth'
import TmsNativeCalendarField from '../components/ui/TmsNativeCalendarField.vue'

/* ===============================
   STATE
================================ */
const currentMonth = getESTMonthKey() // YYYY-MM in EST (system timezone)
const selectedMonth = ref(currentMonth) // YYYY-MM
const selectedGroupId = ref('all')   // 'all' or group code (GROUP_1, etc.)
const selectedWeek = ref('all')
const loading = ref(false)
const error = ref(null)
const metrics = ref(null)
const rankingMetrics = ref(null) // Separate metrics for ranking sections (always all members)
const groups = ref([])
const byGroupSummary = ref([])

const monthlyPlans = ref([])
const periodicPlans = ref([])
const periods = ref([])
const currentWeekPeriod = ref(null)
const showMonthFlowerShower = ref(false)
const showWeekFlowerShower = ref(false)

/* ===============================
   HELPERS
================================ */

/** A month runs from the 6th to the 5th of the next month. */
const getMonthRange = (month) => {
  const { start, end } = monthRangeKeys(month)

  return {
    start: new Date(`${start}T00:00:00.000Z`).toISOString(),
    end: new Date(`${end}T23:59:59.999Z`).toISOString()
  }
}

/* ===============================
   API
================================ */

// const loadFinanceOverview = async () => {
//   loading.value = true
//   error.value = null

//   try {
//     const { start, end } = getMonthRange(selectedMonth.value)

//     const res = await apiClient.get('finance/finance-overview', {
//       params: {
//         start,
//         end,
//         memberId: selectedMemberId.value
//       }
//     })

//     metrics.value = res.data.data.metrics
//   } catch (err) {
//     console.error(err)
//     error.value = err
//   } finally {
//     loading.value = false
//   }
// }
// Load overview data (respects user selection - for first section)
const loadFinanceOverview = async () => {
  loading.value = true
  error.value = null

  try {
    const { start, end } = getMonthRange(selectedMonth.value)

    // Overview: all members in scope; group filter only via groupId
    const res = await apiClient.get('finance/finance-overview', {
      params: {
        start,
        end,
        memberId: 'all',
        groupId: selectedGroupId.value !== 'all' ? selectedGroupId.value : undefined
      }
    })

    metrics.value = res.data.data.metrics
    byGroupSummary.value = res.data.data.byGroupSummary || []
    console.log('Finance Overview API Response:', res.data.data)
    console.log('Week Metrics from API:', res.data.data.metrics?.week)
    console.log('Week Metrics length:', res.data.data.metrics?.week?.length)

    const monthlyPlansResponse = await financeService.fetchMonthlyPlans({
      month: selectedMonth.value
    })
    if (monthlyPlansResponse.ok && monthlyPlansResponse.data) {
      monthlyPlans.value = monthlyPlansResponse.data.plans || []
    }

    // Load periods for the selected month
    const periodsResponse = await financeService.fetchPeriods({
      month: selectedMonth.value
    })
    if (periodsResponse.ok && periodsResponse.data) {
      periods.value = periodsResponse.data.periods || []
      // Find the last week period (sorted by endDate descending, take first)
      const sortedPeriods = [...periods.value].sort((a, b) => {
        const dateA = new Date(a.endDate)
        const dateB = new Date(b.endDate)
        return dateB - dateA // Descending
      })
      // Store the full period object, not just the definition
      currentWeekPeriod.value = sortedPeriods.length > 0 ? sortedPeriods[0] : null
      
      if (currentWeekPeriod.value) {
        const periodicPlansResponse = await financeService.fetchPeriodicPlans({
          periodId: currentWeekPeriod.value._id
        })
        if (periodicPlansResponse.ok && periodicPlansResponse.data) {
          periodicPlans.value = periodicPlansResponse.data.plans || []
        }
      } else {
        periodicPlans.value = []
      }
    }
  } catch (err) {
    console.error(err)
    error.value = err
  } finally {
    loading.value = false
    // After data loads, ensure animations are correct - ONLY show if >= 100%
    setTimeout(() => {
      const monthProgress = Number(computedMonthMetrics.value?.progressPercentage) || 0
      const weekProgress = Number(computedWeekMetrics.value?.progressPercentage) || 0
      
      // Month: ONLY show if >= 100%, otherwise hide
      if (monthProgress >= 100) {
        showMonthFlowerShower.value = true
        setTimeout(() => {
          showMonthFlowerShower.value = false
        }, 3000)
      } else {
        showMonthFlowerShower.value = false
      }
      
      // Week: ONLY show if >= 100%, otherwise hide
      if (weekProgress >= 100) {
        showWeekFlowerShower.value = true
        setTimeout(() => {
          showWeekFlowerShower.value = false
        }, 3000)
      } else {
        showWeekFlowerShower.value = false
      }
    }, 300)
  }
}

// Load ranking data (always all members - for monthly and yearly ranking sections)
const loadRankingData = async () => {
  try {
    const { start, end } = getMonthRange(selectedMonth.value)

    // Ranking sections use same group filter
    const res = await apiClient.get('finance/finance-overview', {
      params: {
        start,
        end,
        memberId: 'all',
        groupId: selectedGroupId.value !== 'all' ? selectedGroupId.value : undefined
      }
    })

    rankingMetrics.value = res.data.data.metrics
  } catch (err) {
    console.error('Failed to load ranking data:', err)
  }
}
const loadGroups = async () => {
  try {
    const res = await fetchGroups();
    groups.value = res?.data?.groups || res?.groups || [];
  } catch (err) {
    groups.value = [];
    console.warn('Failed to load groups', err);
  }
};
/* ===============================
   WATCHERS
================================ */
onMounted(async () => {
  await loadGroups()
  loadFinanceOverview()
  loadRankingData()
})

// Watch filters for overview section
watch([selectedMonth, selectedGroupId], () => {
  loadFinanceOverview()
}, { immediate: false })

// Watch for ranking sections
watch([selectedMonth, selectedGroupId], () => {
  loadRankingData()
}, { immediate: false })

/* ===============================
   SAFE COMPUTEDS
================================ */

const yearMetrics = computed(() => metrics.value?.year ?? null)
const monthMetrics = computed(() => metrics.value?.month ?? null)
const weekMetrics = computed(() => {
  const weeks = metrics.value?.week ?? []
  console.log('weekMetrics computed: Raw weeks from API', weeks)
  console.log('weekMetrics computed: weeks length', weeks.length)
  
  if (weeks.length === 0) {
    console.log('weekMetrics computed: No weeks found')
    return []
  }
  
  // Sort weeks in ascending order (week1, week2, week3...)
  const sorted = [...weeks].sort((a, b) => {
    // Extract week number from period string (e.g., "Week 1" -> 1)
    const weekA = parseInt(a.period?.replace(/[^0-9]/g, '') || '0')
    const weekB = parseInt(b.period?.replace(/[^0-9]/g, '') || '0')
    return weekA - weekB
  })
  
  console.log('weekMetrics computed: Sorted weeks', sorted)
  return sorted
})

// Computed for pie chart data (income distribution by user)
// const getIncomeDistributionData = (metricsData) => {
//   if (!metricsData?.byUser) return []

//   return metricsData.byUser
//     .filter(user => user.actualIncome >= 0)
//     .map(user => ({
//       label: user.user.name || user.user.email,
//       value: user.actualIncome
//     }))
// }
const getIncomeDistributionData = (metricsData) => {
  if (!metricsData?.byUser?.length) return []

  const data = metricsData.byUser.map(user => ({
    label: user.user.name || user.user.email,
    value: user.actualIncome
  }))

  const total = data.reduce((s, i) => s + i.value, 0)

  return total === 0
    ? [{ label: 'No income yet', value: 1 }]
    : data
}
// Computed for ranking chart data (by actual income)
const getRankingData = (metricsData) => {
  if (!metricsData?.byUser) return []

  return metricsData.byUser
    .map(user => ({
      label: user.user.name || user.user.email,
      value: user.actualIncome
    }))
    .filter(item => item.value >=0)
    .sort((a, b) => b.value - a.value) // Sort descending
}

// Computed for profit ranking chart data
const getProfitRankingData = (metricsData) => {
  if (!metricsData?.byUser) return []

  return metricsData.byUser
    .map(user => {
      const profit = (user.actualIncome || 0) - (user.actualExpense || 0)
      return {
        label: user.user.name || user.user.email,
        value: profit
      }
    })
    // Include all members, even with 0 values
    .sort((a, b) => b.value - a.value) // Sort descending
}

// Computed for progress ranking chart data
const getProgressRankingData = (metricsData) => {
  if (!metricsData?.byUser) return []

  return metricsData.byUser
    .map(user => {
      const income = user.actualIncome || 0
      const outcome = user.actualExpense || 0
      const profit = income - outcome
      const pending = user.pendingIncome || 0
      const plan = user.target || 0
      
      // Calculate progress percentage: (total profit + pending amount / 2) / total plan * 100
      const progressPercentage = plan > 0 
        ? Math.round(((profit + pending / 2) / plan) * 100)
        : 0
      
      return {
        label: user.user.name || user.user.email,
        value: Math.max(0, progressPercentage) // Allow > 100%
      }
    })
    // Include all members, even with 0% progress
    .sort((a, b) => b.value - a.value) // Sort descending
}

// Computed for user summary data (for the table/list)
const getUserSummaryData = (metricsData) => {
  if (!metricsData?.byUser) return []

  return metricsData.byUser
    .map(user => {
      const income = user.actualIncome || 0
      const outcome = user.actualExpense || 0
      const profit = income - outcome
      const pending = user.pendingIncome || 0
      const plan = user.target || 0
      const resultAmount = profit - plan
      
      // Calculate progress percentage: (total profit + pending amount / 2) / total plan * 100
      const progressPercentage = plan > 0 
        ? Math.round(((profit + pending / 2) / plan) * 100)
        : 0

      return {
        userId: user.user._id || user.user.id,
        name: user.user.name || user.user.email,
        email: user.user.email,
        income,
        outcome,
        profit,
        pending,
        plan,
        resultAmount,
        progressPercentage: Math.max(0, progressPercentage) // Allow > 100%
      }
    })
    .sort((a, b) => b.profit - a.profit) // Sort by profit descending
}

// Computed for target achievement pie chart
const getTargetAchievementData = (metricsData) => {
  if (!metricsData?.total) return []

  const total = metricsData.total
  const achieved = total.actualIncome
  const remaining = Math.max(0, total.target - achieved)

  return [
    { label: 'Achieved', value: achieved },
    { label: 'Remaining', value: remaining }
  ].filter(item => item.value >=0)
}

// Computed for performance breakdown pie chart
const getPerformanceBreakdownData = (metricsData) => {
  if (!metricsData?.total) return []

  const total = metricsData.total
  return [
    { label: 'Actual Income', value: total.actualIncome },
    { label: 'Pending Income', value: total.pendingIncome },
    { label: 'Actual Expense', value: total.actualExpense }
  ].filter(item => item.value >=0)
}

// Groups available for filter: super admin sees all + can switch; others see all for summary but detail only own
const availableGroupsForFilter = computed(() => groups.value)

// Ranking metrics (always all members)
const rankingYearMetrics = computed(() => rankingMetrics.value?.year ?? null)
const rankingMonthMetrics = computed(() => rankingMetrics.value?.month ?? null)

// Year ranking data (always all members)
const yearIncomeDistribution = computed(() => getIncomeDistributionData(rankingYearMetrics.value))
const yearRankingData = computed(() => getRankingData(rankingYearMetrics.value))
const yearProfitRankingData = computed(() => getProfitRankingData(rankingYearMetrics.value))
const yearProgressRankingData = computed(() => getProgressRankingData(rankingYearMetrics.value))
const yearUserSummaryData = computed(() => getUserSummaryData(rankingYearMetrics.value))
const yearTargetAchievement = computed(() => getTargetAchievementData(rankingYearMetrics.value))
const yearPerformanceBreakdown = computed(() => getPerformanceBreakdownData(rankingYearMetrics.value))

// Month ranking data (always all members)
const monthIncomeDistribution = computed(() => getIncomeDistributionData(rankingMonthMetrics.value))
const monthRankingData = computed(() => getRankingData(rankingMonthMetrics.value))
const monthProfitRankingData = computed(() => getProfitRankingData(rankingMonthMetrics.value))
const monthProgressRankingData = computed(() => getProgressRankingData(rankingMonthMetrics.value))
const monthUserSummaryData = computed(() => getUserSummaryData(rankingMonthMetrics.value))
const monthTargetAchievement = computed(() => getTargetAchievementData(rankingMonthMetrics.value))
const monthPerformanceBreakdown = computed(() => getPerformanceBreakdownData(rankingMonthMetrics.value))

// Selected week data
const selectedWeekData = computed(() => {
  if (selectedWeek.value === 'all' || !weekMetrics.value.length) return null
  return weekMetrics.value.find(w => w.period === selectedWeek.value)
})

// Get the last active week from weekMetrics (for Week Overview)
const lastActiveWeek = computed(() => {
  if (!weekMetrics.value || weekMetrics.value.length === 0) return null
  
  // Find the week that matches the currentWeekPeriod definition
  if (currentWeekPeriod.value?.definition) {
    const matchedWeek = weekMetrics.value.find(w => w.period === currentWeekPeriod.value.definition)
    if (matchedWeek) return matchedWeek
  }
  
  // If no match, return the last week in the array (assuming it's sorted by date)
  return weekMetrics.value[weekMetrics.value.length - 1]
})

const weekIncomeDistribution = computed(() => getIncomeDistributionData(selectedWeekData.value))
const weekRankingData = computed(() => getRankingData(selectedWeekData.value))
const weekTargetAchievement = computed(() => getTargetAchievementData(selectedWeekData.value))
const weekPerformanceBreakdown = computed(() => getPerformanceBreakdownData(selectedWeekData.value))

// Helper function to format amount
const formatAmount = (amount) => {
  return parseFloat(amount || 0).toFixed(2)
}

// Helper function to get progress badge class
const getProgressBadgeClass = (progress) => {
  if (progress >= 100) return 'progress-excellent'
  if (progress >= 80) return 'progress-good'
  if (progress >= 50) return 'progress-fair'
  return 'progress-low'
}

// Helper function to get rank badge class
const getRankBadgeClass = (index) => {
  if (index === 0) return 'rank-gold'
  if (index === 1) return 'rank-silver'
  if (index === 2) return 'rank-bronze'
  return 'rank-default'
}

// Month metrics computation
const computedMonthMetrics = computed(() => {
  if (!monthMetrics.value?.total) {
    return {
      totalIncome: 0,
      totalOutcome: 0,
      incomeWallet: 0,
      incomeNoWallet: 0,
      outcomeWallet: 0,
      outcomeNoWallet: 0,
      totalProfit: 0,
      totalPending: 0,
      totalPlan: 0,
      resultAmount: 0,
      progressPercentage: 0
    }
  }

  const total = monthMetrics.value.total
  const totalIncome = total.actualIncome || 0
  const totalOutcome = total.actualExpense || 0
  const incomeWallet = total.actualIncomeWallet || 0
  const incomeNoWallet = total.actualIncomeNoWallet || 0
  const outcomeWallet = total.actualExpenseWallet || 0
  const outcomeNoWallet = total.actualExpenseNoWallet || 0
  const totalProfit = totalIncome - totalOutcome
  const totalPending = total.pendingIncome || 0

  // Plan total must match the same user scope as income/outcome (team / selected group).
  // The overview API aggregates `total.target` from monthly plans for those users only.
  // Summing `monthlyPlans` here was wrong for admins: that list can include every team.
  const apiMonthTarget = total.target
  const totalPlan =
    typeof apiMonthTarget === 'number' && !Number.isNaN(apiMonthTarget)
      ? apiMonthTarget
      : monthlyPlans.value.reduce(
          (sum, plan) => sum + (plan.monthlyFinancialGoal || 0),
          0
        )

  // Calculate result amount (profit - plan) - positive means ahead, negative means behind
  const resultAmount = totalProfit - totalPlan
  
  // Calculate progress percentage: (total profit + pending amount / 2) / total plan * 100
  const progressPercentage = totalPlan > 0 
    ? Math.round(((totalProfit + totalPending / 2) / totalPlan) * 100)
    : 0
  
  return {
    totalIncome,
    totalOutcome,
    incomeWallet,
    incomeNoWallet,
    outcomeWallet,
    outcomeNoWallet,
    totalProfit,
    totalPending,
    totalPlan,
    resultAmount,
    progressPercentage: Math.max(0, progressPercentage) // Allow > 100%
  }
})

// Week metrics computation - uses last active week from weekMetrics
const computedWeekMetrics = computed(() => {
  if (!lastActiveWeek.value?.total) {
    return {
      totalIncome: 0,
      totalOutcome: 0,
      incomeWallet: 0,
      incomeNoWallet: 0,
      outcomeWallet: 0,
      outcomeNoWallet: 0,
      totalProfit: 0,
      totalPending: 0,
      totalPlan: 0,
      resultAmount: 0,
      progressPercentage: 0
    }
  }

  const total = lastActiveWeek.value.total
  const totalIncome = total.actualIncome || 0
  const totalOutcome = total.actualExpense || 0
  const incomeWallet = total.actualIncomeWallet || 0
  const incomeNoWallet = total.actualIncomeNoWallet || 0
  const outcomeWallet = total.actualExpenseWallet || 0
  const outcomeNoWallet = total.actualExpenseNoWallet || 0
  const totalProfit = totalIncome - totalOutcome
  const totalPending = total.pendingIncome || 0
  
  // Use target from weekMetrics API response (it already has the correct plan)
  const totalPlan = total.target || 0
  
  // Calculate result amount (profit - plan) - positive means ahead, negative means behind
  const resultAmount = totalProfit - totalPlan
  
  // Calculate progress percentage: (total profit + pending amount / 2) / total plan * 100
  const progressPercentage = totalPlan > 0 
    ? Math.round(((totalProfit + totalPending / 2) / totalPlan) * 100)
    : 0
  
  return {
    totalIncome,
    totalOutcome,
    incomeWallet,
    incomeNoWallet,
    outcomeWallet,
    outcomeNoWallet,
    totalProfit,
    totalPending,
    totalPlan,
    resultAmount,
    progressPercentage: Math.max(0, progressPercentage) // Allow > 100%
  }
})

// Chart data for Month Overview
const monthIncomeOutcomeData = computed(() => {
  return [
    { label: 'Income', value: computedMonthMetrics.value.totalIncome },
    { label: 'Outcome', value: computedMonthMetrics.value.totalOutcome },
    { label: 'Pending', value: computedMonthMetrics.value.totalPending }
  ].filter(item => item.value > 0)
})

const monthComparisonData = computed(() => {
  return [
    { label: 'Income', value: computedMonthMetrics.value.totalIncome },
    { label: 'Outcome', value: computedMonthMetrics.value.totalOutcome },
    { label: 'Profit', value: computedMonthMetrics.value.totalProfit }
  ]
})

// Chart data for Week Overview
const weekIncomeOutcomeData = computed(() => {
  return [
    { label: 'Income', value: computedWeekMetrics.value.totalIncome },
    { label: 'Outcome', value: computedWeekMetrics.value.totalOutcome },
    { label: 'Pending', value: computedWeekMetrics.value.totalPending }
  ].filter(item => item.value > 0)
})

const weekComparisonData = computed(() => {
  return [
    { label: 'Income', value: computedWeekMetrics.value.totalIncome },
    { label: 'Outcome', value: computedWeekMetrics.value.totalOutcome },
    { label: 'Profit', value: computedWeekMetrics.value.totalProfit }
  ]
})

// Compute metrics for each week
const computedWeekMetricsList = computed(() => {
  if (!weekMetrics.value || weekMetrics.value.length === 0) {
    console.log('computedWeekMetricsList: No weekMetrics data', weekMetrics.value)
    return []
  }
  
  console.log('computedWeekMetricsList: Processing weeks', weekMetrics.value.length, weekMetrics.value)
  
  return weekMetrics.value.map((week, index) => {
    const total = week.total || {}
    const totalIncome = total.actualIncome || 0
    const totalOutcome = total.actualExpense || 0
    const totalProfit = totalIncome - totalOutcome
    const totalPending = total.pendingIncome || 0
    const totalPlan = total.target || 0
    const resultAmount = totalProfit - totalPlan
    
    // Calculate progress percentage: (total profit + pending amount / 2) / total plan * 100
    const progressPercentage = totalPlan > 0 
      ? Math.round(((totalProfit + totalPending / 2) / totalPlan) * 100)
      : 0
    
    const weekData = {
      period: week.period || `Week ${index + 1}`,
      totalIncome,
      totalOutcome,
      totalProfit,
      totalPending,
      totalPlan,
      resultAmount,
      progressPercentage: Math.max(0, progressPercentage)
    }
    
    console.log(`computedWeekMetricsList: Week ${index + 1}`, weekData)
    return weekData
  })
})

// Watch for progress changes to trigger flower shower animations
watch([computedMonthMetrics, computedWeekMetrics], ([monthMetrics, weekMetrics], [oldMonthMetrics, oldWeekMetrics]) => {
  // Get current progress values - ensure they are numbers
  const monthProgress = Number(monthMetrics?.progressPercentage) || 0
  const weekProgress = Number(weekMetrics?.progressPercentage) || 0
  
  // Get old progress values - ensure they are numbers
  const oldMonthProgress = oldMonthMetrics ? (Number(oldMonthMetrics.progressPercentage) || 0) : null
  const oldWeekProgress = oldWeekMetrics ? (Number(oldWeekMetrics.progressPercentage) || 0) : null
  
  // Month Overview - Flower Shower (ONLY when >= 100%)
  // CRITICAL: Always hide if progress < 100%
  if (monthProgress < 100) {
    showMonthFlowerShower.value = false
  } else if (monthProgress >= 100 && oldMonthProgress !== null && monthProgress !== oldMonthProgress) {
    // Only show if progress changed AND is >= 100%
    showMonthFlowerShower.value = false // Reset first
    setTimeout(() => {
      showMonthFlowerShower.value = true
      setTimeout(() => {
        showMonthFlowerShower.value = false
      }, 3000)
    }, 200)
  }
  
  // Week Overview - Flower Shower (ONLY when >= 100%)
  // CRITICAL: Always hide if progress < 100%
  if (weekProgress < 100) {
    showWeekFlowerShower.value = false
  } else if (weekProgress >= 100 && oldWeekProgress !== null && weekProgress !== oldWeekProgress) {
    // Only show if progress changed AND is >= 100%
    showWeekFlowerShower.value = false // Reset first
    setTimeout(() => {
      showWeekFlowerShower.value = true
      setTimeout(() => {
        showWeekFlowerShower.value = false
      }, 3000)
    }, 200)
  }
}, { immediate: false })
</script>

<template>
  <div class="finance-overview">
    <!-- HEADER -->
    <div class="page-header">
      <div class="header-content">
        <div>
          <h1>Finance Overview</h1>
          <p class="subtitle">{{ formatMonth(selectedMonth) }}</p>
        </div>
        <div class="filters">
          <label class="filter-item">
            <span class="filter-label">Month:</span>
            <TmsNativeCalendarField v-model="selectedMonth" type="month" />
          </label>
          <label v-if="availableGroupsForFilter.length > 0" class="filter-item">
            <span class="filter-label">Group:</span>
            <select v-model="selectedGroupId" class="filter-select">
              <option value="all">All Groups</option>
              <option v-for="g in availableGroupsForFilter" :key="g._id" :value="g.code">
                {{ g.name }}
              </option>
            </select>
          </label>
        </div>
      </div>
    </div>

    <!-- LOADING STATE -->
    <div v-if="loading" class="loading-container">
      <div class="spinner"></div>
      <p>Loading finance overview...</p>
    </div>

    <!-- ERROR STATE -->
    <div v-if="error" class="error-container">
      <div class="error-icon">⚠️</div>
      <h3>Failed to load data</h3>
      <p>{{ error.message || 'Please try again later' }}</p>
      <button @click="loadFinanceOverview" class="retry-button">Retry</button>
    </div>

    <!-- CONTENT -->
    <div v-if="!loading && !error && metrics" class="content">
      <!-- All Groups Summary (top, super admin only when viewing all) -->
      <section v-if="byGroupSummary && byGroupSummary.length > 0" class="dashboard-section groups-summary-section">
        <div class="section-header">
          <h2 class="section-title">
            <span class="title-icon">📋</span>
            All Groups Summary - {{ formatMonth(selectedMonth) }}
          </h2>
        </div>
        <div class="groups-summary-grid">
          <div
            v-for="g in byGroupSummary"
            :key="g.group"
            class="group-summary-card"
          >
            <h4 class="group-summary-name">{{ g.groupName || g.group }}</h4>
            <div class="group-summary-metrics">
              <div class="group-metric">
                <span class="group-metric-label">Income</span>
                <span class="group-metric-value income-value">{{ formatAmount(g.actualIncome) }}</span>
              </div>
              <div class="group-metric">
                <span class="group-metric-label">Outcome</span>
                <span class="group-metric-value expense-value">{{ formatAmount(g.actualExpense) }}</span>
              </div>
              <div class="group-metric">
                <span class="group-metric-label">Profit</span>
                <span class="group-metric-value" :class="(g.profit || 0) >= 0 ? 'income-value' : 'expense-value'">
                  {{ formatAmount(g.profit) }}
                </span>
              </div>
              <div class="group-metric">
                <span class="group-metric-label">Members</span>
                <span class="group-metric-value">{{ g.userCount || 0 }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Finance Overview Section -->
      <section class="dashboard-section">
        <div class="section-header">
          <h2 class="section-title">
            <span class="title-icon">📊</span>
            Finance Overview
          </h2>
        </div>
        
        <!-- Month and Week Overview -->
        <div class="overview-cards">
          <!-- Month Overview -->
          <div class="overview-card">
            <!-- Month Flower Shower Animation -->
            <FlowerShower 
              :show="showMonthFlowerShower" 
              :duration="3000"
            />
            
            <div class="overview-card-header">
              <h3>{{ formatMonth(selectedMonth) }} - Month Overview</h3>
            </div>
            <div class="overview-content-split">
              <!-- Left: Summary Data -->
              <div class="overview-data-section">
                <div class="metric-row">
                  <span class="metric-label">Total Income:</span>
                  <span class="metric-value income-value">
                    {{ formatAmount(computedMonthMetrics.totalIncome) }}
                    <span class="wallet-split">
                      (Team Wallet: {{ formatAmount(computedMonthMetrics.incomeWallet) }}
                      + No Wallet: {{ formatAmount(computedMonthMetrics.incomeNoWallet) }})
                    </span>
                  </span>
                </div>
                <div class="metric-row">
                  <span class="metric-label">Total Outcome:</span>
                  <span class="metric-value expense-value">
                    {{ formatAmount(computedMonthMetrics.totalOutcome) }}
                    <span class="wallet-split">
                      (Team Wallet: {{ formatAmount(computedMonthMetrics.outcomeWallet) }}
                      + No Wallet: {{ formatAmount(computedMonthMetrics.outcomeNoWallet) }})
                    </span>
                  </span>
                </div>
                <div class="metric-row profit-highlight">
                  <span class="metric-label">Total Profit:</span>
                  <span class="metric-value profit-value" :class="computedMonthMetrics.totalProfit >= 0 ? 'income-value' : 'expense-value'">
                    {{ formatAmount(computedMonthMetrics.totalProfit) }}
                  </span>
                </div>
                <div class="metric-row">
                  <span class="metric-label">Total Pending:</span>
                  <span class="metric-value pending-value">{{ formatAmount(computedMonthMetrics.totalPending) }}</span>
                </div>
                <div class="metric-row">
                  <span class="metric-label">Result Amount:</span>
                  <span class="metric-value" :class="computedMonthMetrics.resultAmount >= 0 ? 'income-value' : 'expense-value'">
                    {{ formatAmount(computedMonthMetrics.resultAmount) }}
                  </span>
                </div>
                <div class="progress-section progress-highlight">
                  <div class="progress-header">
                    <span class="progress-label">Progress</span>
                    <span class="progress-percentage"><strong>{{ computedMonthMetrics.progressPercentage }}%</strong></span>
                  </div>
                  <div class="progress-bar-container">
                    <div
                      class="progress-bar-fill"
                      :class="{ 'progress-overflow': computedMonthMetrics.progressPercentage > 100 }"
                      :style="{ width: `${Math.min(computedMonthMetrics.progressPercentage, 100)}%` }"
                    ></div>
                    <div
                      v-if="computedMonthMetrics.progressPercentage > 100"
                      class="progress-bar-overflow"
                      :style="{ width: `${computedMonthMetrics.progressPercentage - 100}%` }"
                    ></div>
                  </div>
                  <div class="progress-plan highlight-plan">
                    <span class="plan-label">Plan:</span>
                    <span class="plan-value">{{ formatAmount(computedMonthMetrics.totalPlan) }}</span>
                  </div>
                </div>
              </div>
              
              <!-- Right: Charts -->
              <div class="overview-charts-section">
                <CircularProgressGauge
                  :percentage="computedMonthMetrics.progressPercentage"
                  label="Progress"
                  :progress-color="computedMonthMetrics.progressPercentage >= 80 ? 'var(--color-success)' : computedMonthMetrics.progressPercentage >= 50 ? 'var(--color-warning)' : 'var(--color-primary)'"
                />
                <MiniDoughnutChart
                  title="Income vs Outcome"
                  :data="monthIncomeOutcomeData"
                />
                <MiniBarChart
                  title="Comparison"
                  :data="monthComparisonData"
                />
              </div>
            </div>
          </div>

          <!-- Week Overview -->
          <div class="overview-card">
            <!-- Week Flower Shower Animation -->
            <FlowerShower 
              :show="showWeekFlowerShower" 
              :duration="3000"
            />
            
            <div class="overview-card-header">
              <h3 v-if="lastActiveWeek">{{ lastActiveWeek.period }} - Week Overview</h3>
              <h3 v-else-if="currentWeekPeriod">{{ currentWeekPeriod.definition }} - Week Overview</h3>
              <h3 v-else>Week Overview</h3>
            </div>
            <div class="overview-content-split">
              <!-- Left: Summary Data -->
              <div class="overview-data-section">
                <div class="metric-row">
                  <span class="metric-label">Total Income:</span>
                  <span class="metric-value income-value">
                    {{ formatAmount(computedWeekMetrics.totalIncome) }}
                    <span class="wallet-split">
                      (Team Wallet: {{ formatAmount(computedWeekMetrics.incomeWallet) }}
                      + No Wallet: {{ formatAmount(computedWeekMetrics.incomeNoWallet) }})
                    </span>
                  </span>
                </div>
                <div class="metric-row">
                  <span class="metric-label">Total Outcome:</span>
                  <span class="metric-value expense-value">
                    {{ formatAmount(computedWeekMetrics.totalOutcome) }}
                    <span class="wallet-split">
                      (Team Wallet: {{ formatAmount(computedWeekMetrics.outcomeWallet) }}
                      + No Wallet: {{ formatAmount(computedWeekMetrics.outcomeNoWallet) }})
                    </span>
                  </span>
                </div>
                <div class="metric-row profit-highlight">
                  <span class="metric-label">Total Profit:</span>
                  <span class="metric-value profit-value" :class="computedWeekMetrics.totalProfit >= 0 ? 'income-value' : 'expense-value'">
                    {{ formatAmount(computedWeekMetrics.totalProfit) }}
                  </span>
                </div>
                <div class="metric-row">
                  <span class="metric-label">Total Pending:</span>
                  <span class="metric-value pending-value">{{ formatAmount(computedWeekMetrics.totalPending) }}</span>
                </div>
                <div class="metric-row">
                  <span class="metric-label">Result Amount:</span>
                  <span class="metric-value" :class="computedWeekMetrics.resultAmount >= 0 ? 'income-value' : 'expense-value'">
                    {{ formatAmount(computedWeekMetrics.resultAmount) }}
                  </span>
                </div>
                <div class="progress-section progress-highlight">
                  <div class="progress-header">
                    <span class="progress-label">Progress</span>
                    <span class="progress-percentage"><strong>{{ computedWeekMetrics.progressPercentage }}%</strong></span>
                  </div>
                  <div class="progress-bar-container">
                    <div
                      class="progress-bar-fill"
                      :class="{ 'progress-overflow': computedWeekMetrics.progressPercentage > 100 }"
                      :style="{ width: `${Math.min(computedWeekMetrics.progressPercentage, 100)}%` }"
                    ></div>
                    <div
                      v-if="computedWeekMetrics.progressPercentage > 100"
                      class="progress-bar-overflow"
                      :style="{ width: `${computedWeekMetrics.progressPercentage - 100}%` }"
                    ></div>
                  </div>
                  <div class="progress-plan highlight-plan">
                    <span class="plan-label">Plan:</span>
                    <span class="plan-value">{{ formatAmount(computedWeekMetrics.totalPlan) }}</span>
                  </div>
                </div>
              </div>
              
              <!-- Right: Charts -->
              <div class="overview-charts-section">
                <CircularProgressGauge
                  :percentage="computedWeekMetrics.progressPercentage"
                  label="Progress"
                  :progress-color="computedWeekMetrics.progressPercentage >= 80 ? 'var(--color-success)' : computedWeekMetrics.progressPercentage >= 50 ? 'var(--color-warning)' : 'var(--color-primary)'"
                />
                <MiniDoughnutChart
                  title="Income vs Outcome"
                  :data="weekIncomeOutcomeData"
                />
                <MiniBarChart
                  title="Comparison"
                  :data="weekComparisonData"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

            <!-- WEEKLY BREAKDOWN SECTION -->
      <section v-if="computedWeekMetricsList && computedWeekMetricsList.length > 0" class="dashboard-section">
        <div class="section-header">
          <h2 class="section-title">
            <span class="title-icon">📆</span>
            Weekly Breakdown
          </h2>
        </div>

        <!-- Weekly Cards Grid -->
        <div class="weekly-breakdown-grid">
          <div 
            v-for="(weekData, index) in computedWeekMetricsList" 
            :key="weekData.period" 
            class="week-card"
            :class="{ 
              'warning-low-progress': weekData.progressPercentage < 50,
              'warning-critical': weekData.progressPercentage < 25,
              'warning-severe': weekData.progressPercentage < 10
            }"
            :style="{ 
              animationDelay: `${index * 0.1}s`,
              '--warning-intensity': weekData.progressPercentage < 50 ? (1 - weekData.progressPercentage / 50) : 0
            }"
          >
            <!-- Week Header -->
            <div class="week-card-header">
              <h3 class="week-card-title">{{ weekData.period }}</h3>
              <div class="week-progress-badge" :class="getProgressBadgeClass(weekData.progressPercentage)">
                {{ weekData.progressPercentage }}%
              </div>
            </div>

            <!-- Metrics Grid -->
            <div class="week-metrics-grid">
              <div class="week-metric-item">
                <div class="week-metric-icon income-icon">💰</div>
                <div class="week-metric-content">
                  <span class="week-metric-label">Income</span>
                  <span class="week-metric-value income-value">{{ formatAmount(weekData.totalIncome) }}</span>
                </div>
              </div>

              <div class="week-metric-item">
                <div class="week-metric-icon expense-icon">💸</div>
                <div class="week-metric-content">
                  <span class="week-metric-label">Outcome</span>
                  <span class="week-metric-value expense-value">{{ formatAmount(weekData.totalOutcome) }}</span>
                </div>
              </div>

              <div class="week-metric-item profit-item">
                <div class="week-metric-icon profit-icon">📈</div>
                <div class="week-metric-content">
                  <span class="week-metric-label">Profit</span>
                  <span class="week-metric-value profit-value" :class="weekData.totalProfit >= 0 ? 'income-value' : 'expense-value'">
                    {{ formatAmount(weekData.totalProfit) }}
                  </span>
                </div>
              </div>

              <div class="week-metric-item">
                <div class="week-metric-icon pending-icon">⏳</div>
                <div class="week-metric-content">
                  <span class="week-metric-label">Pending</span>
                  <span class="week-metric-value pending-value">{{ formatAmount(weekData.totalPending) }}</span>
                </div>
              </div>

              <div class="week-metric-item">
                <div class="week-metric-icon result-icon">🎯</div>
                <div class="week-metric-content">
                  <span class="week-metric-label">Result</span>
                  <span class="week-metric-value" :class="weekData.resultAmount >= 0 ? 'income-value' : 'expense-value'">
                    {{ formatAmount(weekData.resultAmount) }}
                  </span>
                </div>
              </div>

              <div class="week-metric-item plan-item">
                <div class="week-metric-icon plan-icon">📊</div>
                <div class="week-metric-content">
                  <span class="week-metric-label">Plan</span>
                  <span class="week-metric-value plan-value">{{ formatAmount(weekData.totalPlan) }}</span>
                </div>
              </div>
            </div>

            <!-- Progress Section -->
            <div class="week-progress-section">
              <div class="week-progress-header">
                <span class="week-progress-label">Progress</span>
                <span class="week-progress-percentage">{{ weekData.progressPercentage }}%</span>
              </div>
              <div class="week-progress-bar-container">
                <div
                  class="week-progress-bar-fill"
                  :class="{ 'week-progress-overflow': weekData.progressPercentage > 100 }"
                  :style="{ width: `${Math.min(weekData.progressPercentage, 100)}%` }"
                ></div>
                <div
                  v-if="weekData.progressPercentage > 100"
                  class="week-progress-bar-overflow"
                  :style="{ width: `${weekData.progressPercentage - 100}%` }"
                ></div>
              </div>
            </div>

            <!-- Mini Chart -->
            <div class="week-mini-chart">
              <MiniDoughnutChart
                :title="weekData.period"
                :data="[
                  { label: 'Profit', value: Math.max(0, weekData.totalProfit) },
                  { label: 'Plan', value: weekData.totalPlan },
                  { label: 'Progress', value: weekData.totalPlan > 0 ? Math.max(0, (weekData.totalProfit + weekData.totalPending / 2)) : 0 }
                ].filter(item => item.value > 0)"
              />
            </div>
          </div>
        </div>
      </section>
            <!-- MONTH SUMMARY SECTION -->
      <!-- MONTHLY RANKING SECTION -->
      <section v-if="rankingMonthMetrics && rankingMonthMetrics.byUser && rankingMonthMetrics.byUser.length > 0" class="dashboard-section">
        <div class="section-header">
          <h2 class="section-title">
            <span class="title-icon">🏆</span>
            Monthly Member Ranking - {{ formatMonth(selectedMonth) }}
          </h2>
        </div>

        <!-- Ranking Charts Row -->
        <div class="ranking-charts-row">
          <div class="ranking-chart-item progress-ranking-chart">
            <FinanceRankingChart 
              title="Progress Ranking" 
              subtitle="Ranked by progress percentage" 
              :data="monthProgressRankingData"
              :formatAsPercentage="true"
              v-if="monthProgressRankingData.length > 0" 
            />
            <div v-else class="empty-chart">
              <p>No progress data available</p>
            </div>
          </div>
          <div class="ranking-chart-item">
            <FinanceRankingChart 
              title="Profit Ranking" 
              subtitle="Ranked by profit (Income - Outcome)" 
              :data="monthProfitRankingData"
              v-if="monthProfitRankingData.length > 0" 
            />
            <div v-else class="empty-chart">
              <p>No profit data available</p>
            </div>
          </div>
        </div>

        <!-- User Summary Table -->
        <div class="user-summary-section">
          <h3 class="user-summary-title">
            <span class="summary-icon">📊</span>
            Member Summary
          </h3>
          <div class="user-summary-grid">
            <div 
              v-for="(user, index) in monthUserSummaryData" 
              :key="user.userId"
              class="user-summary-card"
              :class="{ 
                'warning-low-progress': user.progressPercentage < 50,
                'warning-critical': user.progressPercentage < 25,
                'warning-severe': user.progressPercentage < 10
              }"
              :style="{ 
                animationDelay: `${index * 0.1}s`,
                '--warning-intensity': user.progressPercentage < 50 ? (1 - user.progressPercentage / 50) : 0
              }"
            >
              <div class="user-summary-header">
                <div class="user-rank-badge" :class="getRankBadgeClass(index)">
                  #{{ index + 1 }}
                </div>
                <div class="user-info">
                  <h4 class="user-name">{{ user.name }}</h4>
                  <p class="user-email" v-if="user.email && user.email !== user.name">{{ user.email }}</p>
                </div>
              </div>
              
              <div class="user-metrics-grid">
                <div class="user-metric-item">
                  <div class="user-metric-icon income-icon">💰</div>
                  <div class="user-metric-content">
                    <span class="user-metric-label">Income</span>
                    <span class="user-metric-value income-value">{{ formatAmount(user.income) }}</span>
                  </div>
                </div>

                <div class="user-metric-item">
                  <div class="user-metric-icon expense-icon">💸</div>
                  <div class="user-metric-content">
                    <span class="user-metric-label">Outcome</span>
                    <span class="user-metric-value expense-value">{{ formatAmount(user.outcome) }}</span>
                  </div>
                </div>

                <div class="user-metric-item profit-item">
                  <div class="user-metric-icon profit-icon">📈</div>
                  <div class="user-metric-content">
                    <span class="user-metric-label">Profit</span>
                    <span class="user-metric-value profit-value" :class="user.profit >= 0 ? 'income-value' : 'expense-value'">
                      {{ formatAmount(user.profit) }}
                    </span>
                  </div>
                </div>

                <div class="user-metric-item">
                  <div class="user-metric-icon pending-icon">⏳</div>
                  <div class="user-metric-content">
                    <span class="user-metric-label">Pending</span>
                    <span class="user-metric-value pending-value">{{ formatAmount(user.pending) }}</span>
                  </div>
                </div>

                <div class="user-metric-item">
                  <div class="user-metric-icon result-icon">🎯</div>
                  <div class="user-metric-content">
                    <span class="user-metric-label">Result</span>
                    <span class="user-metric-value" :class="user.resultAmount >= 0 ? 'income-value' : 'expense-value'">
                      {{ formatAmount(user.resultAmount) }}
                    </span>
                  </div>
                </div>

                <div class="user-metric-item plan-item">
                  <div class="user-metric-icon plan-icon">📊</div>
                  <div class="user-metric-content">
                    <span class="user-metric-label">Plan</span>
                    <span class="user-metric-value plan-value">{{ formatAmount(user.plan) }}</span>
                  </div>
                </div>
              </div>

              <!-- Progress Section -->
              <div class="user-progress-section">
                <div class="user-progress-header">
                  <span class="user-progress-label">Progress</span>
                  <span class="user-progress-percentage" :class="getProgressBadgeClass(user.progressPercentage)">
                    {{ user.progressPercentage }}%
                  </span>
                </div>
                <div class="user-progress-bar-container">
                  <div
                    class="user-progress-bar-fill"
                    :class="{ 'user-progress-overflow': user.progressPercentage > 100 }"
                    :style="{ width: `${Math.min(user.progressPercentage, 100)}%` }"
                  ></div>
                  <div
                    v-if="user.progressPercentage > 100"
                    class="user-progress-bar-overflow"
                    :style="{ width: `${user.progressPercentage - 100}%` }"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <!-- YEARLY RANKING SECTION -->
      <section v-if="rankingYearMetrics && rankingYearMetrics.byUser && rankingYearMetrics.byUser.length > 0" class="dashboard-section">
        <div class="section-header">
          <h2 class="section-title">
            <span class="title-icon">🏆</span>
            Annual Member Ranking - {{ selectedMonth.split('-')[0] }}
          </h2>
        </div>

        <!-- Ranking Charts Row -->
        <div class="ranking-charts-row">
          <div class="ranking-chart-item progress-ranking-chart">
            <FinanceRankingChart 
              title="Progress Ranking" 
              subtitle="Ranked by progress percentage" 
              :data="yearProgressRankingData"
              :formatAsPercentage="true"
              v-if="yearProgressRankingData.length > 0" 
            />
            <div v-else class="empty-chart">
              <p>No progress data available</p>
            </div>
          </div>
          <div class="ranking-chart-item">
            <FinanceRankingChart 
              title="Profit Ranking" 
              subtitle="Ranked by profit (Income - Outcome)" 
              :data="yearProfitRankingData"
              v-if="yearProfitRankingData.length > 0" 
            />
            <div v-else class="empty-chart">
              <p>No profit data available</p>
            </div>
          </div>
        </div>

        <!-- User Summary Table -->
        <div class="user-summary-section">
          <h3 class="user-summary-title">
            <span class="summary-icon">📊</span>
            Member Summary (All Months)
          </h3>
          <div class="user-summary-grid">
            <div 
              v-for="(user, index) in yearUserSummaryData" 
              :key="user.userId"
              class="user-summary-card"
              :style="{ 
                animationDelay: `${index * 0.1}s`,
                '--warning-intensity': user.progressPercentage < 50 ? (1 - user.progressPercentage / 50) : 0
              }"
            >
              <div class="user-summary-header">
                <div class="user-rank-badge" :class="getRankBadgeClass(index)">
                  #{{ index + 1 }}
                </div>
                <div class="user-info">
                  <h4 class="user-name">{{ user.name }}</h4>
                  <p class="user-email" v-if="user.email && user.email !== user.name">{{ user.email }}</p>
                </div>
              </div>
              
              <div class="user-metrics-grid">
                <div class="user-metric-item">
                  <div class="user-metric-icon income-icon">💰</div>
                  <div class="user-metric-content">
                    <span class="user-metric-label">Income</span>
                    <span class="user-metric-value income-value">{{ formatAmount(user.income) }}</span>
                  </div>
                </div>

                <div class="user-metric-item">
                  <div class="user-metric-icon expense-icon">💸</div>
                  <div class="user-metric-content">
                    <span class="user-metric-label">Outcome</span>
                    <span class="user-metric-value expense-value">{{ formatAmount(user.outcome) }}</span>
                  </div>
                </div>

                <div class="user-metric-item profit-item">
                  <div class="user-metric-icon profit-icon">📈</div>
                  <div class="user-metric-content">
                    <span class="user-metric-label">Profit</span>
                    <span class="user-metric-value profit-value" :class="user.profit >= 0 ? 'income-value' : 'expense-value'">
                      {{ formatAmount(user.profit) }}
                    </span>
                  </div>
                </div>

                <div class="user-metric-item">
                  <div class="user-metric-icon pending-icon">⏳</div>
                  <div class="user-metric-content">
                    <span class="user-metric-label">Pending</span>
                    <span class="user-metric-value pending-value">{{ formatAmount(user.pending) }}</span>
                  </div>
                </div>

                <div class="user-metric-item">
                  <div class="user-metric-icon result-icon">🎯</div>
                  <div class="user-metric-content">
                    <span class="user-metric-label">Result</span>
                    <span class="user-metric-value" :class="user.resultAmount >= 0 ? 'income-value' : 'expense-value'">
                      {{ formatAmount(user.resultAmount) }}
                    </span>
                  </div>
                </div>

                <div class="user-metric-item plan-item">
                  <div class="user-metric-icon plan-icon">📊</div>
                  <div class="user-metric-content">
                    <span class="user-metric-label">Plan</span>
                    <span class="user-metric-value plan-value">{{ formatAmount(user.plan) }}</span>
                  </div>
                </div>
              </div>

              <!-- Progress Section -->
              <div class="user-progress-section">
                <div class="user-progress-header">
                  <span class="user-progress-label">Progress</span>
                  <span class="user-progress-percentage" :class="getProgressBadgeClass(user.progressPercentage)">
                    {{ user.progressPercentage }}%
                  </span>
                </div>
                <div class="user-progress-bar-container">
                  <div
                    class="user-progress-bar-fill"
                    :class="{ 'user-progress-overflow': user.progressPercentage > 100 }"
                    :style="{ width: `${Math.min(user.progressPercentage, 100)}%` }"
                  ></div>
                  <div
                    v-if="user.progressPercentage > 100"
                    class="user-progress-bar-overflow"
                    :style="{ width: `${user.progressPercentage - 100}%` }"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>




    </div>
  </div>
</template>

<style scoped>
.finance-overview {
  min-height: 100vh;
  background: transparent;
  padding: 0;
  max-width: min(1600px, 100%);
  margin: 0 auto;
  min-width: 0;
}

.page-header {
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  margin-bottom: var(--spacing-lg);
  box-shadow: var(--shadow-md);
  border: 1px solid var(--border-light);
  position: relative;
  overflow: hidden;
}

.page-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--color-primary) 0%, var(--color-secondary) 50%, var(--color-primary-light) 100%);
  opacity: 0.9;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: var(--spacing-lg);
  position: relative;
  z-index: 1;
}

.header-content > div:first-child {
  min-width: 0;
  flex: 1 1 200px;
}

.page-header h1 {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin: 0 0 var(--spacing-xs) 0;
  letter-spacing: -0.02em;
}

.subtitle {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin: 0;
}

.filters {
  display: flex;
  gap: var(--spacing-md);
  flex-wrap: wrap;
  align-items: flex-end;
  padding: var(--spacing-md) var(--spacing-lg);
  background: linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
  flex: 1 1 280px;
  justify-content: flex-end;
  max-width: 100%;
}

.filter-item {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--spacing-xs);
  min-width: 0;
}

.filter-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.filter-input,
.filter-select {
  min-width: 0;
  width: 100%;
  max-width: min(220px, 100%);
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1.5px solid var(--border-medium);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  background: var(--bg-primary);
  color: var(--text-primary);
  transition: all var(--transition-base);
  box-shadow: var(--shadow-sm);
}

.filter-input:focus,
.filter-select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.loading-container,
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-3xl) var(--spacing-xl);
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  border: 1px solid var(--border-light);
}

.spinner {
  width: 48px;
  height: 48px;
  border: 3px solid var(--border-light);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: var(--spacing-lg);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-icon {
  font-size: 48px;
  margin-bottom: var(--spacing-lg);
}

.error-container h3 {
  font-size: var(--font-size-xl);
  color: var(--text-primary);
  margin: 0 0 var(--spacing-sm) 0;
  font-weight: var(--font-weight-semibold);
}

.error-container p {
  color: var(--text-secondary);
  margin: 0 0 var(--spacing-lg) 0;
}

.retry-button {
  padding: var(--spacing-md) var(--spacing-xl);
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
  color: var(--text-inverse);
  border: none;
  border-radius: var(--radius-md);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all var(--transition-base);
  box-shadow: var(--shadow-md);
}

.retry-button:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-lg);
}

.content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.dashboard-section {
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  box-shadow: var(--shadow-md);
  border: 1px solid var(--border-light);
  transition: all var(--transition-base);
}

.dashboard-section:hover {
  box-shadow: var(--shadow-lg);
}

.groups-summary-section {
  margin-bottom: var(--spacing-lg);
  background: linear-gradient(180deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
}

.groups-summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
  gap: var(--spacing-lg);
  align-items: stretch;
}

.group-summary-card {
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  border: 1px solid var(--border-light);
  box-shadow: var(--shadow-sm);
  transition: transform var(--transition-base), box-shadow var(--transition-base), border-color var(--transition-base);
  position: relative;
  overflow: hidden;
}

.group-summary-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  opacity: 0.95;
}

.group-summary-card:nth-child(5n + 1)::before {
  background: linear-gradient(90deg, var(--color-primary), var(--color-primary-light));
}

.group-summary-card:nth-child(5n + 2)::before {
  background: linear-gradient(90deg, var(--color-secondary), #a78bfa);
}

.group-summary-card:nth-child(5n + 3)::before {
  background: linear-gradient(90deg, var(--color-info), #60a5fa);
}

.group-summary-card:nth-child(5n + 4)::before {
  background: linear-gradient(90deg, var(--color-success), #34d399);
}

.group-summary-card:nth-child(5n)::before {
  background: linear-gradient(90deg, #f59e0b, #fbbf24);
}

.group-summary-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-lg);
  border-color: var(--border-medium);
}

.group-summary-name {
  margin: 0 0 var(--spacing-md) 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  letter-spacing: -0.02em;
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--border-light);
}

.group-summary-metrics {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-sm);
}

.group-metric {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-md);
  font-size: var(--font-size-sm);
  padding: var(--spacing-xs) 0;
  border-bottom: 1px dashed var(--border-light);
}

.group-metric:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.group-metric-label {
  color: var(--text-secondary);
  font-weight: var(--font-weight-medium);
}

.group-metric-value {
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
  flex-wrap: wrap;
  gap: var(--spacing-md);
}

.section-title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  letter-spacing: -0.01em;
}

.title-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  font-size: 1.35rem;
  line-height: 1;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.14) 0%, rgba(139, 92, 246, 0.12) 100%);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: var(--radius-md);
  flex-shrink: 0;
}

.summary-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  font-size: 1.2rem;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(139, 92, 246, 0.1));
  border-radius: var(--radius-md);
  flex-shrink: 0;
}

.week-selector {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-secondary);
}

.week-select {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1.5px solid var(--border-medium);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  background: var(--bg-primary);
  color: var(--text-primary);
  transition: all var(--transition-base);
}

.week-select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-xl);
}

.charts-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--spacing-lg);
}

.chart-item {
  min-height: 400px;
}

.empty-chart {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 400px;
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  border: 2px dashed var(--border-medium);
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
}

.week-section {
  margin-bottom: var(--spacing-xl);
  padding-bottom: var(--spacing-xl);
  border-bottom: 1px solid var(--border-light);
}

.week-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.week-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--spacing-lg) 0;
}

@media (max-width: 1024px) {
  .charts-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .finance-overview {
    padding: 0;
  }

  .page-header {
    padding: var(--spacing-lg);
  }

  .page-header h1 {
    font-size: var(--font-size-2xl);
  }

  .header-content {
    flex-direction: column;
    align-items: flex-start;
  }

  .dashboard-section {
    padding: var(--spacing-lg);
  }

  .metrics-grid {
    grid-template-columns: 1fr;
    gap: var(--spacing-md);
  }

  .section-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .section-title {
    font-size: var(--font-size-xl);
  }

  .filters {
    width: 100%;
    justify-content: stretch;
    flex: none;
  }

  .filter-item {
    flex: 1 1 140px;
    min-width: 0;
  }

  .filter-input,
  .filter-select {
    max-width: none;
  }

  .groups-summary-grid {
    grid-template-columns: 1fr;
  }
}

/* Overview Section Styles */
.overview-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-top: 20px;
}

.overview-card {
  background: var(--bg-tertiary);
  border-radius: 8px;
  padding: 20px;
  border: 1px solid var(--border-light);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  animation: slideInUp 0.5s ease-out;
  animation-fill-mode: both;
  position: relative;
  overflow: hidden;
}

.overview-card:nth-child(1) {
  animation-delay: 0.1s;
}

.overview-card:nth-child(2) {
  animation-delay: 0.2s;
}

.overview-card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-4px);
  border-color: var(--color-primary);
}

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.overview-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 2px solid var(--border-light);
}

.overview-card-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
}

.overview-period {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.overview-content-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-top: 8px;
}

.overview-data-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.overview-charts-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
  justify-content: center;
}

.overview-metrics {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.metric-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  transition: all 0.2s ease;
  animation: fadeInRow 0.4s ease-out;
  animation-fill-mode: both;
}

.metric-row:nth-child(1) { animation-delay: 0.1s; }
.metric-row:nth-child(2) { animation-delay: 0.15s; }
.metric-row:nth-child(3) { animation-delay: 0.2s; }
.metric-row:nth-child(4) { animation-delay: 0.25s; }
.metric-row:nth-child(5) { animation-delay: 0.3s; }

.metric-row:hover {
  transform: translateX(4px);
  padding-left: 8px;
}

@keyframes fadeInRow {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.metric-label {
  font-size: 0.9rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.metric-value {
  font-size: 1rem;
  font-weight: 600;
  transition: all 0.3s ease;
  text-align: right;
}

.metric-value:hover {
  transform: scale(1.05);
}

.wallet-split {
  display: block;
  margin-top: 2px;
  font-size: 0.72rem;
  font-weight: 400;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.metric-value.income-value {
  color: var(--color-success);
}

.metric-value.expense-value {
  color: var(--color-error);
}

.metric-value.pending-value {
  color: var(--color-warning);
}

.profit-highlight {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(16, 185, 129, 0.05) 100%);
  border-radius: 8px;
  padding: 12px 16px !important;
  margin: 8px 0 !important;
  border: 2px solid transparent;
  transition: all 0.3s ease;
  animation: pulse 2s ease-in-out infinite;
}

.profit-highlight:hover {
  border-color: var(--color-primary);
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%);
  transform: scale(1.02);
}

.profit-value {
  font-size: 1.4rem !important;
  font-weight: 700 !important;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  letter-spacing: -0.02em;
  animation: countUp 0.8s ease-out;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(99, 102, 241, 0);
  }
}

@keyframes countUp {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.progress-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-light);
}

.progress-highlight {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%);
  border-radius: 12px;
  padding: 20px;
  margin-top: 20px;
  border: 2px solid rgba(99, 102, 241, 0.2);
  transition: all 0.3s ease;
  animation: fadeInScale 0.6s ease-out 0.3s both;
}

.progress-highlight:hover {
  border-color: var(--color-primary);
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(16, 185, 129, 0.12) 100%);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
}

@keyframes fadeInScale {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.progress-label {
  font-size: 0.9rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.progress-percentage {
  font-size: 2rem;
  font-weight: 800;
  color: var(--color-primary);
  text-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
  letter-spacing: -0.03em;
  animation: numberCount 1s ease-out;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-success) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

@keyframes numberCount {
  from {
    opacity: 0;
    transform: translateY(-10px) scale(0.8);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.progress-bar-container {
  width: 100%;
  height: 8px;
  background: var(--bg-primary);
  border-radius: 4px;
  overflow: visible;
  margin-bottom: 8px;
  position: relative;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary) 0%, var(--color-success) 50%, var(--color-primary) 100%);
  background-size: 200% 100%;
  border-radius: 4px;
  transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  animation: progressFill 1.2s ease-out, shimmer 2s infinite;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2);
  position: relative;
  overflow: hidden;
}

.progress-bar-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  animation: shimmerMove 2s infinite;
}

@keyframes progressFill {
  from {
    width: 0% !important;
  }
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

@keyframes shimmerMove {
  0% {
    left: -100%;
  }
  100% {
    left: 100%;
  }
}

.progress-plan {
  font-size: 0.85rem;
  color: var(--text-tertiary);
  text-align: right;
}

.highlight-plan {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%);
  border-radius: 6px;
  margin-top: 8px;
  border: 1px solid rgba(99, 102, 241, 0.2);
  animation: planPulse 2s ease-in-out infinite;
}

.plan-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.plan-value {
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--color-primary);
  text-shadow: 0 1px 2px rgba(99, 102, 241, 0.2);
  letter-spacing: -0.02em;
}

.progress-bar-overflow {
  position: absolute;
  top: 0;
  left: 100%;
  height: 100%;
  background: linear-gradient(90deg, var(--color-success) 0%, #22c55e 50%, var(--color-success) 100%);
  background-size: 200% 100%;
  border-radius: 0 4px 4px 0;
  animation: shimmer 2s infinite;
  box-shadow: 0 2px 6px rgba(34, 197, 94, 0.25);
  border-left: 1px solid rgba(255, 255, 255, 0.4);
  transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 2;
  opacity: 0.9;
}

.progress-overflow {
  border-radius: 4px 0 0 4px;
  border-right: 1px solid rgba(255, 255, 255, 0.4);
}

@keyframes planPulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.3);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(99, 102, 241, 0);
  }
}

@keyframes overflowPulse {
  0%, 100% {
    opacity: 1;
    transform: scaleY(1);
  }
  50% {
    opacity: 0.9;
    transform: scaleY(1.05);
  }
}

@media (max-width: 1024px) {
  .overview-content-split {
    grid-template-columns: 1fr;
    gap: 20px;
  }
  
  .overview-charts-section {
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: space-around;
  }
}

@media (max-width: 768px) {
  .overview-cards {
    grid-template-columns: 1fr;
  }
  
  .overview-charts-section {
    flex-direction: column;
  }

  .weekly-breakdown-grid {
    grid-template-columns: 1fr;
    gap: 16px;
    justify-items: stretch;
  }

  .week-metrics-grid {
    grid-template-columns: 1fr;
  }

  .profit-item,
  .plan-item {
    grid-column: span 1;
  }
}

/* Weekly Breakdown Styles */
.weekly-breakdown-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 24px;
  margin-top: 24px;
  justify-items: center;
  justify-content: center;
}

.week-card {
  background: var(--bg-primary);
  border-radius: 12px;
  padding: 24px;
  border: 1px solid var(--border-light);
  box-shadow: var(--shadow-sm);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  animation: slideInUp 0.6s ease-out both;
  position: relative;
  overflow: hidden;
}

.week-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--color-primary) 0%, var(--color-success) 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.week-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
  border-color: var(--color-primary);
}

.week-card:hover::before {
  opacity: 1;
}

/* Warning animations for low progress */
.week-card.warning-low-progress {
  border-color: rgba(239, 68, 68, 0.3);
  animation: warningPulse 2s ease-in-out infinite, slideInUp 0.6s ease-out both;
}

.week-card.warning-critical {
  border-color: rgba(239, 68, 68, 0.5);
  animation: warningPulseCritical 1.5s ease-in-out infinite, slideInUp 0.6s ease-out both;
}

.week-card.warning-severe {
  border-color: rgba(239, 68, 68, 0.7);
  animation: warningPulseSevere 1s ease-in-out infinite, slideInUp 0.6s ease-out both;
}

.week-card.warning-low-progress::before {
  background: linear-gradient(90deg, rgba(239, 68, 68, 0.6) 0%, rgba(220, 38, 38, 0.6) 100%);
}

.week-card.warning-critical::before {
  background: linear-gradient(90deg, rgba(239, 68, 68, 0.8) 0%, rgba(220, 38, 38, 0.8) 100%);
}

.week-card.warning-severe::before {
  background: linear-gradient(90deg, rgba(239, 68, 68, 1) 0%, rgba(220, 38, 38, 1) 100%);
}

.week-card.warning-low-progress:hover::before {
  opacity: 0.6;
}

.week-card.warning-critical:hover::before {
  opacity: 0.8;
}

.week-card.warning-severe:hover::before {
  opacity: 1;
}

@keyframes warningPulse {
  0%, 100% {
    box-shadow: var(--shadow-sm), 
                0 0 0 0 rgba(239, 68, 68, calc(0.3 * var(--warning-intensity, 0.5))),
                0 0 20px rgba(239, 68, 68, calc(0.1 * var(--warning-intensity, 0.5)));
  }
  50% {
    box-shadow: var(--shadow-sm), 
                0 0 0 8px rgba(239, 68, 68, calc(0.15 * var(--warning-intensity, 0.5))),
                0 0 30px rgba(239, 68, 68, calc(0.2 * var(--warning-intensity, 0.5)));
  }
}

@keyframes warningPulseCritical {
  0%, 100% {
    box-shadow: var(--shadow-sm), 
                0 0 0 0 rgba(239, 68, 68, calc(0.5 * var(--warning-intensity, 0.9))),
                0 0 10px rgba(239, 68, 68, calc(0.2 * var(--warning-intensity, 0.9)));
  }
  50% {
    box-shadow: var(--shadow-sm), 
                0 0 0 10px rgba(239, 68, 68, calc(0.25 * var(--warning-intensity, 0.9))),
                0 0 20px rgba(239, 68, 68, calc(0.35 * var(--warning-intensity, 0.9)));
  }
}

@keyframes warningPulseSevere {
  0%, 100% {
    box-shadow: var(--shadow-sm), 
                0 0 0 0 rgba(239, 68, 68, calc(0.7 * var(--warning-intensity, 0.9))),
                0 0 30px rgba(239, 68, 68, calc(0.3 * var(--warning-intensity, 0.9)));
  }
  50% {
    box-shadow: var(--shadow-sm), 
                0 0 0 12px rgba(239, 68, 68, calc(0.35 * var(--warning-intensity, 0.9))),
                0 0 50px rgba(239, 68, 68, calc(0.5 * var(--warning-intensity, 0.9)));
  }
}

.week-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 2px solid var(--border-light);
}

.week-card-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.week-progress-badge {
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 700;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  animation: badgePulse 2s ease-in-out infinite;
}

.progress-excellent {
  background: linear-gradient(135deg, var(--color-success) 0%, #22c55e 100%);
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.4);
}

.progress-good {
  background: linear-gradient(135deg, #22c55e 0%, var(--color-success) 100%);
  box-shadow: 0 2px 8px rgba(34, 197, 94, 0.3);
}

.progress-fair {
  background: linear-gradient(135deg, var(--color-warning) 0%, #fbbf24 100%);
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
}

.progress-low {
  background: linear-gradient(135deg, var(--color-primary) 0%, #6366f1 100%);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

@keyframes badgePulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

.week-metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.week-metric-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg-tertiary);
  border-radius: 8px;
  transition: all 0.2s ease;
  animation: fadeInScale 0.4s ease-out both;
}

.week-metric-item:nth-child(1) { animation-delay: 0.1s; }
.week-metric-item:nth-child(2) { animation-delay: 0.15s; }
.week-metric-item:nth-child(3) { animation-delay: 0.2s; }
.week-metric-item:nth-child(4) { animation-delay: 0.25s; }
.week-metric-item:nth-child(5) { animation-delay: 0.3s; }
.week-metric-item:nth-child(6) { animation-delay: 0.35s; }

.week-metric-item:hover {
  transform: translateX(4px);
  background: var(--bg-primary);
  box-shadow: var(--shadow-sm);
}

.profit-item {
  grid-column: span 2;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%);
  border: 1px solid rgba(99, 102, 241, 0.2);
}

.plan-item {
  grid-column: span 2;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%);
  border: 1px solid rgba(99, 102, 241, 0.15);
}

.week-metric-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  font-size: 1.5rem;
  flex-shrink: 0;
}

.income-icon {
  background: rgba(16, 185, 129, 0.15);
}

.expense-icon {
  background: rgba(239, 68, 68, 0.15);
}

.profit-icon {
  background: rgba(99, 102, 241, 0.15);
}

.pending-icon {
  background: rgba(245, 158, 11, 0.15);
}

.result-icon {
  background: rgba(139, 92, 246, 0.15);
}

.plan-icon {
  background: rgba(59, 130, 246, 0.15);
}

.week-metric-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.week-metric-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.week-metric-value {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.week-progress-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--border-light);
}

.week-progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.week-progress-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 600;
}

.week-progress-percentage {
  font-size: 1.25rem;
  font-weight: 800;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-success) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.week-progress-bar-container {
  width: 100%;
  height: 10px;
  background: var(--bg-tertiary);
  border-radius: 5px;
  overflow: visible;
  position: relative;
}

.week-progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary) 0%, var(--color-success) 50%, var(--color-primary) 100%);
  background-size: 200% 100%;
  border-radius: 5px;
  transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  animation: shimmer 2s infinite;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
  position: relative;
  z-index: 1;
}

.week-progress-bar-overflow {
  position: absolute;
  top: 0;
  left: 100%;
  height: 100%;
  background: linear-gradient(90deg, var(--color-success) 0%, #22c55e 50%, var(--color-success) 100%);
  background-size: 200% 100%;
  border-radius: 0 5px 5px 0;
  animation: shimmer 2s infinite;
  box-shadow: 0 2px 6px rgba(34, 197, 94, 0.25);
  border-left: 1px solid rgba(255, 255, 255, 0.4);
  transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 2;
  opacity: 0.9;
}

.week-progress-overflow {
  border-radius: 5px 0 0 5px;
  border-right: 1px solid rgba(255, 255, 255, 0.4);
}

.week-mini-chart {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--border-light);
}

/* Monthly Ranking Section Styles */
.ranking-charts-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
  margin-bottom: 32px;
  align-items: center;
}

.ranking-chart-item {
  min-height: 400px;
  position: relative;
  transition: all 0.3s ease;
}

.ranking-chart-item:hover {
  transform: translateY(-4px);
}

.progress-ranking-chart {
  position: relative;
  padding: 20px;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(34, 197, 94, 0.05) 100%);
  border-radius: 16px;
  border: 2px solid transparent;
  box-shadow: 0 4px 20px rgba(16, 185, 129, 0.1);
  animation: progressChartGlow 3s ease-in-out infinite;
  overflow: hidden;
}

.progress-ranking-chart::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(34, 197, 94, 0.1) 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
  z-index: 0;
}

.progress-ranking-chart:hover {
  border-color: var(--color-success);
  box-shadow: 0 8px 30px rgba(16, 185, 129, 0.2);
  transform: translateY(-6px) scale(1.02);
}

.progress-ranking-chart:hover::before {
  opacity: 1;
}

.progress-ranking-chart::after {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, transparent 70%);
  animation: progressChartRotate 8s linear infinite;
  pointer-events: none;
  z-index: 0;
}

.progress-ranking-chart > * {
  position: relative;
  z-index: 1;
}

@keyframes progressChartGlow {
  0%, 100% {
    box-shadow: 0 4px 20px rgba(16, 185, 129, 0.1);
  }
  50% {
    box-shadow: 0 4px 30px rgba(16, 185, 129, 0.2), 0 0 40px rgba(34, 197, 94, 0.15);
  }
}

@keyframes progressChartRotate {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.user-summary-section {
  margin-top: 40px;
  padding-top: 32px;
  border-top: 2px solid var(--border-light);
}

.user-summary-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 24px 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
  gap: 20px;
  justify-items: stretch;
}

.user-summary-card {
  width: 100%;
  max-width: 500px;
  background: var(--bg-primary);
  border-radius: 16px;
  padding: 24px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
  transition: all 0.3s ease;
  animation: slideInUp 0.6s ease-out backwards;
  position: relative;
  overflow: hidden;
}

.user-summary-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: linear-gradient(180deg, var(--color-primary) 0%, var(--color-success) 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.user-summary-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-md);
  border-color: var(--color-primary);
}

.user-summary-card:hover::before {
  opacity: 1;
}

/* Warning animations for low progress */
.user-summary-card.warning-low-progress {
  border-color: rgba(239, 68, 68, 0.3);
  animation: warningPulse 2s ease-in-out infinite, slideInUp 0.6s ease-out backwards;
}

.user-summary-card.warning-critical {
  border-color: rgba(239, 68, 68, 0.5);
  animation: warningPulseCritical 1.5s ease-in-out infinite, slideInUp 0.6s ease-out backwards;
}

.user-summary-card.warning-severe {
  border-color: rgba(239, 68, 68, 0.7);
  animation: warningPulseSevere 1s ease-in-out infinite, slideInUp 0.6s ease-out backwards;
}

.user-summary-card.warning-low-progress::before {
  background: linear-gradient(180deg, rgba(239, 68, 68, 0.6) 0%, rgba(220, 38, 38, 0.6) 100%);
}

.user-summary-card.warning-critical::before {
  background: linear-gradient(180deg, rgba(239, 68, 68, 0.8) 0%, rgba(220, 38, 38, 0.8) 100%);
}

.user-summary-card.warning-severe::before {
  background: linear-gradient(180deg, rgba(239, 68, 68, 1) 0%, rgba(220, 38, 38, 1) 100%);
}

.user-summary-card.warning-low-progress:hover::before {
  opacity: 0.6;
}

.user-summary-card.warning-critical:hover::before {
  opacity: 0.8;
}

.user-summary-card.warning-severe:hover::before {
  opacity: 1;
}

.user-summary-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 2px solid var(--border-light);
}

.user-rank-badge {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: 800;
  color: white;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  animation: badgePulse 2s ease-in-out infinite;
}

.rank-gold {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.4);
}

.rank-silver {
  background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%);
  box-shadow: 0 4px 12px rgba(148, 163, 184, 0.4);
}

.rank-bronze {
  background: linear-gradient(135deg, #cd7f32 0%, #b87333 100%);
  box-shadow: 0 4px 12px rgba(205, 127, 50, 0.4);
}

.rank-default {
  background: linear-gradient(135deg, var(--color-primary) 0%, #6366f1 100%);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  margin: 0 0 4px 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-email {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.user-metric-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg-tertiary);
  border-radius: 10px;
  transition: all 0.2s ease;
}

.user-metric-item:hover {
  background: var(--bg-secondary);
  transform: translateY(-2px);
}

.user-metric-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.user-metric-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.user-metric-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.user-metric-value {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.user-metric-item.profit-item {
  grid-column: span 2;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(34, 197, 94, 0.1) 100%);
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.user-metric-item.plan-item {
  grid-column: span 2;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
  border: 1px solid rgba(99, 102, 241, 0.2);
}

/* User Progress Section */
.user-progress-section {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 2px solid var(--border-light);
}

.user-progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.user-progress-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.user-progress-percentage {
  font-size: 1.5rem;
  font-weight: 800;
  padding: 8px 16px;
  border-radius: 12px;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  animation: badgePulse 2s ease-in-out infinite;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.user-progress-percentage.progress-excellent {
  background: linear-gradient(135deg, var(--color-success) 0%, #22c55e 100%);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

.user-progress-percentage.progress-good {
  background: linear-gradient(135deg, #22c55e 0%, var(--color-success) 100%);
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
}

.user-progress-percentage.progress-fair {
  background: linear-gradient(135deg, var(--color-warning) 0%, #fbbf24 100%);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

.user-progress-percentage.progress-low {
  background: linear-gradient(135deg, var(--color-primary) 0%, #6366f1 100%);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.user-progress-bar-container {
  width: 100%;
  height: 12px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  overflow: visible;
  position: relative;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
}

.user-progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-success) 0%, #22c55e 50%, var(--color-success) 100%);
  background-size: 200% 100%;
  border-radius: 6px;
  transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
  animation: progressShimmer 2s ease-in-out infinite;
}

.user-progress-bar-fill.user-progress-overflow {
  border-radius: 6px 0 0 6px;
}

.user-progress-bar-overflow {
  position: absolute;
  top: 0;
  left: 100%;
  height: 100%;
  background: linear-gradient(90deg, var(--color-success) 0%, #22c55e 50%, var(--color-success) 100%);
  background-size: 200% 100%;
  border-radius: 0 6px 6px 0;
  opacity: 0.9;
  border-left: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 2px 8px rgba(34, 197, 94, 0.25);
  z-index: 2;
  animation: progressShimmer 2s ease-in-out infinite;
}

@keyframes progressShimmer {
  0%, 100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes badgePulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

@media (max-width: 1024px) {
  .ranking-charts-row {
    grid-template-columns: 1fr;
    gap: 20px;
  }

  .user-summary-grid {
    grid-template-columns: 1fr;
    justify-items: stretch;
  }

  .user-summary-card {
    max-width: 100%;
  }
}

@media (max-width: 768px) {
  .user-metrics-grid {
    grid-template-columns: 1fr;
  }

  .user-metric-item.profit-item,
  .user-metric-item.plan-item {
    grid-column: span 1;
  }
}
</style>
