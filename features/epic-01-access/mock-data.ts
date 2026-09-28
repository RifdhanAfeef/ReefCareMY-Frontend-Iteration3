import type { AccessRequest, CaseRecord, UserAccount } from "./types";

export const currentCoordinatorName = "Daniel Lim";

export const users: UserAccount[] = [
  {
    id: "USR-0108",
    name: "Aisha Rahman",
    email: "aisha@example.org",
    role: "observer",
    status: "Active",
  },
  {
    id: "USR-0032",
    name: "Daniel Lim",
    email: "daniel@example.org",
    role: "case_coordinator",
    status: "Active",
  },
  {
    id: "USR-0064",
    name: "Mei Tan",
    email: "mei@example.org",
    role: "observer",
    status: "Pending",
  },
  {
    id: "USR-0003",
    name: "Admin User",
    email: "admin@reefcare.my",
    role: "system_administrator",
    status: "Active",
  },
];

export const accessRequests: AccessRequest[] = [
  {
    id: "AR-0018",
    userId: "USR-0032",
    userName: "Daniel Lim",
    email: "daniel@example.org",
    currentRole: "observer",
    requestedRole: "case_coordinator",
    requestedAt: "26/08/2026, 8:54 PM",
    status: "Pending",
  },
  {
    id: "AR-0019",
    userId: "USR-0091",
    userName: "Nur Iman",
    email: "iman@example.org",
    currentRole: "observer",
    requestedRole: "case_coordinator",
    requestedAt: "27/08/2026, 10:20 AM",
    status: "Pending",
  },
];

export const cases: CaseRecord[] = [
  {
    reportReference: "RC-0241",
    threat: "Ghost fishing gear",
    generalLocation: "Tioman Island",
    exactLocation: "2.8056, 104.1698",
    locationConfidenceCode: "within_100m",
    statusCode: "under_review",
    statusLabel: "Under Review",
    submittedAt: "26/08/2026, 8:12 PM",
    submittedBy: "Aisha Rahman",
    observedAt: "26/08/2026, 3:10 PM",
    estimatedDepth: "15 m",
    description: "Large net tangled around branching coral.",
    owner: "Daniel Lim",
    claimedAt: "26/08/2026, 8:35 PM",
    activity: [
      {
        id: "ACT-2401",
        action: "Report received",
        actor: "Aisha Rahman",
        timestamp: "26/08/2026, 8:12 PM",
      },
      {
        id: "ACT-2402",
        action: "Case claimed",
        actor: "Daniel Lim",
        timestamp: "26/08/2026, 8:35 PM",
      },
      {
        id: "ACT-2403",
        action: "Evidence marked usable",
        actor: "Daniel Lim",
        timestamp: "26/08/2026, 8:48 PM",
      },
    ],
  },
  {
    reportReference: "RC-0242",
    threat: "Coral bleaching",
    generalLocation: "Perhentian Islands",
    exactLocation: "5.9021, 102.7416",
    locationConfidenceCode: "within_1km",
    statusCode: "under_review",
    statusLabel: "Under Review",
    submittedAt: "27/08/2026, 9:05 AM",
    submittedBy: "Nur Syafiqah",
    observedAt: "27/08/2026, 8:40 AM",
    estimatedDepth: "8 m",
    description: "Several pale coral colonies observed along the reef slope.",
    owner: "Farah Aziz",
    claimedAt: "27/08/2026, 9:24 AM",
    activity: [
      {
        id: "ACT-2421",
        action: "Report received",
        actor: "Nur Syafiqah",
        timestamp: "27/08/2026, 9:05 AM",
      },
      {
        id: "ACT-2422",
        action: "Case claimed",
        actor: "Farah Aziz",
        timestamp: "27/08/2026, 9:24 AM",
      },
    ],
  },
  {
    reportReference: "RC-0243",
    threat: "Marine debris",
    generalLocation: "Redang Island",
    exactLocation: "5.7772, 103.0064",
    locationConfidenceCode: "exact",
    statusCode: "received",
    statusLabel: "Received",
    submittedAt: "27/08/2026, 11:42 AM",
    submittedBy: "Hafiz Omar",
    observedAt: "27/08/2026, 10:55 AM",
    estimatedDepth: "12 m",
    description: "Plastic sheet and fishing line resting across coral rubble.",
    owner: null,
    claimedAt: null,
    activity: [
      {
        id: "ACT-2431",
        action: "Report received",
        actor: "Hafiz Omar",
        timestamp: "27/08/2026, 11:42 AM",
      },
    ],
  },
  {
    reportReference: "RC-0244",
    threat: "Physical reef damage",
    generalLocation: "Lang Tengah Island",
    exactLocation: "5.7941, 102.8967",
    locationConfidenceCode: "dive_site_only",
    statusCode: "received",
    statusLabel: "Received",
    submittedAt: "28/08/2026, 8:18 AM",
    submittedBy: "Siti Mariam",
    observedAt: "28/08/2026, 7:45 AM",
    estimatedDepth: "10 m",
    description: "Broken branching coral near a commonly used mooring area.",
    owner: null,
    claimedAt: null,
    activity: [
      {
        id: "ACT-2441",
        action: "Report received",
        actor: "Siti Mariam",
        timestamp: "28/08/2026, 8:18 AM",
      },
    ],
  },
];

export function findCase(reportId: string) {
  return cases.find(
    (item) =>
      item.reportReference.toLowerCase() === reportId.toLowerCase(),
  );
}

export function findAccessRequest(requestId: string) {
  return accessRequests.find(
    (item) => item.id.toLowerCase() === requestId.toLowerCase(),
  );
}
