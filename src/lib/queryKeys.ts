/**
 * Centralized React Query key definitions.
 * Using a factory pattern for type-safe, consistent cache key management.
 * 
 * Usage:
 *   queryKey: queryKeys.students.list(filters)
 *   queryClient.invalidateQueries({ queryKey: queryKeys.students.all })
 */
export const queryKeys = {
  // Students
  students: {
    all: ['students'] as const,
    list: (filters?: Record<string, unknown>) => ['students-list', filters] as const,
    detail: (id: string) => ['student-detail', id] as const,
    guardians: (id: string) => ['student-guardians', id] as const,
  },

  // Teachers / Users
  teachers: {
    all: ['teachers'] as const,
    list: (filters?: Record<string, unknown>) => ['teachers-list', filters] as const,
    detail: (id: string) => ['teacher-detail', id] as const,
  },

  // Classes
  classes: {
    all: ['classes'] as const,
    list: (academicYearId?: string) => ['classes-list', academicYearId] as const,
    detail: (id: string) => ['class-detail', id] as const,
    students: (classId: string) => ['students-in-class', classId] as const,
  },

  // Attendance
  attendance: {
    all: ['attendance'] as const,
    records: (classId: string, date: string) => ['attendance-records', classId, date] as const,
    stats: (classId: string) => ['class-attendance-stats', classId] as const,
    students: (classId: string) => ['students-attendance', classId] as const,
  },

  // Finance / Tuition
  finance: {
    all: ['tuition-fees'] as const,
    list: (filters?: Record<string, unknown>) => ['tuition-fees-list', filters] as const,
    detail: (id: string) => ['fee-detail', id] as const,
  },

  // Health
  health: {
    all: ['health'] as const,
    records: (studentId: string) => ['health-records', studentId] as const,
    studentsList: (classId: string, search: string) => ['health-students-list-full', classId, search] as const,
  },

  // Nutrition / Meal Plans
  nutrition: {
    all: ['meal-plans'] as const,
    weekly: (startDate: string, endDate: string, classId: string) => ['meal-plans-weekly', startDate, endDate, classId] as const,
    detail: (id: string) => ['meal-plan-detail', id] as const,
  },

  // Evaluations
  evaluations: {
    all: ['evaluations'] as const,
    studentsList: (classId: string, search: string) => ['evals-students-list-full', classId, search] as const,
    records: (studentId: string) => ['student-evaluations', studentId] as const,
    profile: (studentId: string) => ['student-eval-profile', studentId] as const,
  },

  // Notifications
  notifications: {
    all: ['notifications'] as const,
    list: (filters?: Record<string, unknown>) => ['notifications-list', filters] as const,
    detail: (id: string) => ['notification-detail', id] as const,
    topbar: (schoolId?: string) => ['topbar-notifications', schoolId] as const,
  },

  // Settings / Academic Years
  academicYears: {
    all: ['academic-years'] as const,
    list: () => ['academic-years-list'] as const,
    topbar: () => ['academic-years-topbar'] as const,
  },

  // Dashboard
  dashboard: {
    stats: (academicYearId?: string) => ['dashboard-stats', academicYearId] as const,
  },
} as const;
