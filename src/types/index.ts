export type UserRole =
  | "admin"
  | "qa"
  | "qc"
  | "reviewer"
  | "analyst"
  | "viewer";

export type SampleStatus =
  | "received"
  | "pending"
  | "in_testing"
  | "in_review"
  | "approved"
  | "rejected"
  | "cancelled"
  | "released";

export type Priority = "low" | "normal" | "high" | "urgent";

export type ApprovalStatus =
  | "pending"
  | "in_review"
  | "approved"
  | "rejected"
  | "cancelled"
  | "released";

export type TestResultStatus = "pass" | "fail" | "retest" | "pending";

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  isActive?: boolean;
}

export interface AppUser extends BaseEntity {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  departmentId?: string;
  departmentName?: string;
  laboratoryId?: string;
  laboratoryName?: string;
  phone?: string;
  avatarUrl?: string;
  isActive: boolean;
  lastLoginAt?: string;
}

export interface Department extends BaseEntity {
  code: string;
  name: string;
  description?: string;
  head?: string;
}

export interface Laboratory extends BaseEntity {
  code: string;
  name: string;
  location?: string;
  departmentId?: string;
  departmentName?: string;
  accreditation?: string;
  contactEmail?: string;
  description?: string;
}

export interface Product extends BaseEntity {
  code: string;
  name: string;
  dosageForm?: string;
  strength?: string;
  customerId?: string;
  customerName?: string;
  description?: string;
}

export interface Customer extends BaseEntity {
  code: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface Material extends BaseEntity {
  code: string;
  name: string;
  type?: string;
  casNumber?: string;
  supplier?: string;
  description?: string;
}

export interface SampleType extends BaseEntity {
  code: string;
  name: string;
  category?: string;
  description?: string;
  retentionDays?: number;
}

export interface StorageCondition extends BaseEntity {
  code: string;
  name: string;
  category?: string;
  temperature?: string;
  humidity?: string;
  description?: string;
}

export interface Unit extends BaseEntity {
  code: string;
  name: string;
  symbol: string;
  category?: string;
  description?: string;
}

export interface Method extends BaseEntity {
  code: string;
  name: string;
  version?: string;
  category?: string;
  description?: string;
  sopReference?: string;
}

export interface Instrument extends BaseEntity {
  code: string;
  name: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  calibrationDue?: string;
  laboratoryId?: string;
  laboratoryName?: string;
  status?: "available" | "in_use" | "maintenance" | "retired";
}

export interface TestParameter {
  id: string;
  name: string;
  unitId?: string;
  unit?: string;
  lowerLimit?: number | null;
  upperLimit?: number | null;
  targetValue?: number | null;
  methodId?: string;
}

export interface TestMaster extends BaseEntity {
  code: string;
  name: string;
  category?: string;
  methodId?: string;
  methodName?: string;
  instrumentId?: string;
  instrumentName?: string;
  estimatedHours?: number;
  parameters: TestParameter[];
  description?: string;
}

export interface Specification extends BaseEntity {
  code: string;
  name: string;
  productId?: string;
  productName?: string;
  version?: string;
  effectiveDate?: string;
  testIds: string[];
  description?: string;
}

export interface SampleAttachment {
  id: string;
  name: string;
  url: string;
  contentType: string;
  size: number;
  uploadedAt: string;
  uploadedBy?: string;
}

export interface Sample extends BaseEntity {
  sampleNumber: string;
  barcode: string;
  productId?: string;
  productName?: string;
  customerId?: string;
  customerName?: string;
  materialId?: string;
  sampleTypeId?: string;
  departmentId?: string;
  laboratoryId?: string;
  batchNumber?: string;
  lotNumber?: string;
  quantity?: number;
  unitId?: string;
  storageConditionId?: string;
  storageConditionName?: string;
  receivedDate: string;
  dueDate?: string;
  priority: Priority;
  status: SampleStatus;
  assignedAnalystId?: string;
  assignedAnalystName?: string;
  specificationId?: string;
  remarks?: string;
  attachments: SampleAttachment[];
}

export interface TestResultParameter {
  parameterId: string;
  name: string;
  unit?: string;
  lowerLimit?: number | null;
  upperLimit?: number | null;
  observedValue?: number | string | null;
  resultStatus: TestResultStatus;
  remarks?: string;
}

export interface LabTest extends BaseEntity {
  testNumber: string;
  sampleId: string;
  sampleNumber: string;
  testMasterId: string;
  testName: string;
  analystId?: string;
  analystName?: string;
  reviewerId?: string;
  reviewerName?: string;
  qaId?: string;
  qaName?: string;
  status: ApprovalStatus;
  resultStatus: TestResultStatus;
  parameters: TestResultParameter[];
  startedAt?: string;
  completedAt?: string;
  reviewedAt?: string;
  approvedAt?: string;
  electronicSignature?: {
    signedBy: string;
    signedByName: string;
    signedAt: string;
    reason: string;
  };
  remarks?: string;
  retestCount: number;
}

export interface Report extends BaseEntity {
  reportNumber: string;
  type: "coa" | "test_report" | "dashboard" | "monthly" | "analyst" | "qa" | "laboratory";
  sampleId?: string;
  sampleNumber?: string;
  testId?: string;
  title: string;
  status: ApprovalStatus;
  version: number;
  content?: string;
  generatedBy?: string;
  generatedByName?: string;
  approvedBy?: string;
  approvedByName?: string;
  pdfUrl?: string;
}

export interface ActivityLog extends BaseEntity {
  action: string;
  entityType: string;
  entityId?: string;
  entityLabel?: string;
  userId: string;
  userName: string;
  userEmail?: string;
  details?: string;
  ipAddress?: string;
}

export interface AuditTrailEntry extends BaseEntity {
  entityType: string;
  entityId: string;
  entityLabel?: string;
  field: string;
  oldValue: string;
  newValue: string;
  userId: string;
  userName: string;
  reason?: string;
  action: "create" | "update" | "delete" | "approve" | "reject" | "release";
}

export interface AppNotification extends BaseEntity {
  userId: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  link?: string;
  isRead: boolean;
}

export interface MasterField {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "date" | "email" | "phone";
  required?: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];
  searchable?: boolean;
  referenceCollection?: string;
  referenceLabelKey?: string;
}

export interface MasterConfig {
  collection: string;
  title: string;
  singular: string;
  description: string;
  fields: MasterField[];
  columns: { key: string; label: string }[];
}
