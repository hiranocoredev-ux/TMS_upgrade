import { ref } from 'vue'

import apiClient from './axios';

export function useFinanceOverview() {
  const loading = ref(false)
  const error = ref(null)
  const data = ref(null)

  const getMonthRange = (month) => {
    const start = new Date(`${month}-01`)
    const end = new Date(start)
    end.setMonth(end.getMonth() + 1)
    end.setDate(0)

    return {
      start: start.toISOString(),
      end: end.toISOString()
    }
  }

  const fetchOverview = async ({ month, memberId = 'all' }) => {
    loading.value = true
    error.value = null

    try {
      const { start, end } = getMonthRange(month)

      const res = await apiClient.get('/finance-overview', {
        params: { start, end, memberId }
      });
console.log(res.data);
      data.value = res.data.data.metrics
    } catch (err) {
      error.value = err
    } finally {
      loading.value = false
    }
  }

  return {
    data,
    loading,
    error,
    fetchOverview
  }
}