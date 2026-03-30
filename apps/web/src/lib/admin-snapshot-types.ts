export type AdminSnapshot = {
  generatedAt: string;
  stats: {
    departments: number;
    users: number;
    hotLeads: number;
    saleLeads: number;
    pendingInvites: number;
  };
  departments: Array<{
    id: number;
    name: string;
    description: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  }>;
  users: Array<{
    id: number;
    name: string;
    email: string;
    role: string;
    departmentId: number | null;
    departmentName: string | null;
    inviteStatus: string;
    createdAt: string | null;
  }>;
  leads: Array<{
    id: number;
    type: string;
    clientName: string;
    phone: string | null;
    email: string | null;
    source: string | null;
    departmentId: number | null;
    departmentName: string | null;
    assignedUserId: number | null;
    assignedUserName: string | null;
    status: string;
    notesSummary: string | null;
    saleAmount: string | null;
    servicePurchased: string | null;
    saleDate: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  }>;
  pendingInvites: Array<{
    id: number;
    email: string;
    departmentId: number | null;
    departmentName: string | null;
    createdAt: string | null;
  }>;
  recentActivity: Array<{
    id: number;
    userId: number;
    actorName: string;
    actorEmail: string;
    action: string;
    entityType: string;
    entityId: number;
    createdAt: string | null;
  }>;
};
