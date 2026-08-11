export interface DeviceContact {
  recordID: string;
  displayName: string | null;
  givenName?: string | null;
  familyName?: string | null;
  phoneNumbers: { label: string; number: string }[];
  emailAddresses: { label: string; email: string }[];
}

export interface AuthedRequest {
  userId: string;
}
