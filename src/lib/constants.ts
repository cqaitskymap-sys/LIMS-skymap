import type { MasterConfig, UserRole } from "@/types";

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "SkyMap LIMS";

export const COLLECTIONS = {
  users: "users",
  roles: "roles",
  departments: "departments",
  laboratories: "laboratories",
  products: "products",
  customers: "customers",
  materials: "materials",
  sampleTypes: "sampleTypes",
  samples: "samples",
  tests: "tests",
  testMasters: "testMasters",
  methods: "methods",
  specifications: "specifications",
  instruments: "instruments",
  units: "units",
  storageConditions: "storageConditions",
  reports: "reports",
  activities: "activities",
  auditTrail: "auditTrail",
  notifications: "notifications",
  counters: "counters",
} as const;

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrator",
  qa: "QA",
  qc: "QC",
  reviewer: "Reviewer",
  analyst: "Analyst",
  viewer: "Viewer",
};

export const ROLE_PERMISSIONS: Record<
  UserRole,
  {
    manageUsers: boolean;
    manageMasters: boolean;
    manageSamples: boolean;
    recordResults: boolean;
    review: boolean;
    approve: boolean;
    release: boolean;
    viewReports: boolean;
    export: boolean;
  }
> = {
  admin: {
    manageUsers: true,
    manageMasters: true,
    manageSamples: true,
    recordResults: true,
    review: true,
    approve: true,
    release: true,
    viewReports: true,
    export: true,
  },
  qa: {
    manageUsers: false,
    manageMasters: true,
    manageSamples: true,
    recordResults: false,
    review: true,
    approve: true,
    release: true,
    viewReports: true,
    export: true,
  },
  qc: {
    manageUsers: false,
    manageMasters: false,
    manageSamples: true,
    recordResults: true,
    review: true,
    approve: false,
    release: false,
    viewReports: true,
    export: true,
  },
  reviewer: {
    manageUsers: false,
    manageMasters: false,
    manageSamples: true,
    recordResults: false,
    review: true,
    approve: false,
    release: false,
    viewReports: true,
    export: true,
  },
  analyst: {
    manageUsers: false,
    manageMasters: false,
    manageSamples: true,
    recordResults: true,
    review: false,
    approve: false,
    release: false,
    viewReports: true,
    export: false,
  },
  viewer: {
    manageUsers: false,
    manageMasters: false,
    manageSamples: false,
    recordResults: false,
    review: false,
    approve: false,
    release: false,
    viewReports: true,
    export: false,
  },
};

export const SAMPLE_STATUS_LABELS = {
  received: "Received",
  pending: "Pending",
  in_testing: "In Testing",
  in_review: "In Review",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
  released: "Released",
} as const;

export const PRIORITY_LABELS = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
} as const;

export const PAGE_SIZE = 10;

export const MASTER_CONFIGS: Record<string, MasterConfig> = {
  departments: {
    collection: COLLECTIONS.departments,
    title: "Department Master",
    singular: "Department",
    description: "Manage laboratory departments and organizational units.",
    fields: [
      { key: "code", label: "Code", type: "text", required: true },
      { key: "name", label: "Name", type: "text", required: true, searchable: true },
      { key: "head", label: "Department Head", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
    ],
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Name" },
      { key: "head", label: "Head" },
      { key: "isActive", label: "Status" },
    ],
  },
  laboratories: {
    collection: COLLECTIONS.laboratories,
    title: "Laboratory Master",
    singular: "Laboratory",
    description: "Configure laboratories, locations, and accreditation details.",
    fields: [
      { key: "code", label: "Code", type: "text", required: true },
      { key: "name", label: "Name", type: "text", required: true, searchable: true },
      { key: "location", label: "Location", type: "text" },
      { key: "accreditation", label: "Accreditation", type: "text" },
      { key: "contactEmail", label: "Contact Email", type: "email" },
      { key: "description", label: "Description", type: "textarea" },
    ],
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Name" },
      { key: "location", label: "Location" },
      { key: "accreditation", label: "Accreditation" },
      { key: "isActive", label: "Status" },
    ],
  },
  products: {
    collection: COLLECTIONS.products,
    title: "Product Master",
    singular: "Product",
    description: "Maintain pharmaceutical products and formulations.",
    fields: [
      { key: "code", label: "Code", type: "text", required: true },
      { key: "name", label: "Name", type: "text", required: true, searchable: true },
      { key: "dosageForm", label: "Dosage Form", type: "text" },
      { key: "strength", label: "Strength", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
    ],
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Name" },
      { key: "dosageForm", label: "Dosage Form" },
      { key: "strength", label: "Strength" },
      { key: "isActive", label: "Status" },
    ],
  },
  customers: {
    collection: COLLECTIONS.customers,
    title: "Customer Master",
    singular: "Customer",
    description: "Manage customers, sponsors, and sample submitters.",
    fields: [
      { key: "code", label: "Code", type: "text", required: true },
      { key: "name", label: "Name", type: "text", required: true, searchable: true },
      { key: "contactPerson", label: "Contact Person", type: "text" },
      { key: "email", label: "Email", type: "email" },
      { key: "phone", label: "Phone", type: "phone" },
      { key: "address", label: "Address", type: "textarea" },
    ],
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Name" },
      { key: "contactPerson", label: "Contact" },
      { key: "email", label: "Email" },
      { key: "isActive", label: "Status" },
    ],
  },
  materials: {
    collection: COLLECTIONS.materials,
    title: "Material Master",
    singular: "Material",
    description: "Track raw materials, reagents, and reference standards.",
    fields: [
      { key: "code", label: "Code", type: "text", required: true },
      { key: "name", label: "Name", type: "text", required: true, searchable: true },
      { key: "type", label: "Type", type: "text" },
      { key: "casNumber", label: "CAS Number", type: "text" },
      { key: "supplier", label: "Supplier", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
    ],
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Name" },
      { key: "type", label: "Type" },
      { key: "casNumber", label: "CAS" },
      { key: "isActive", label: "Status" },
    ],
  },
  "sample-types": {
    collection: COLLECTIONS.sampleTypes,
    title: "Sample Type Master",
    singular: "Sample Type",
    description: "Define sample categories used during sample registration.",
    fields: [
      { key: "code", label: "Code", type: "text", required: true },
      { key: "name", label: "Name", type: "text", required: true, searchable: true },
      { key: "retentionDays", label: "Retention Days", type: "number" },
      { key: "description", label: "Description", type: "textarea" },
    ],
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Name" },
      { key: "retentionDays", label: "Retention Days" },
      { key: "isActive", label: "Status" },
    ],
  },
  "storage-conditions": {
    collection: COLLECTIONS.storageConditions,
    title: "Storage Condition Master",
    singular: "Storage Condition",
    description: "Maintain temperature and humidity storage requirements.",
    fields: [
      { key: "code", label: "Code", type: "text", required: true },
      { key: "name", label: "Name", type: "text", required: true, searchable: true },
      { key: "temperature", label: "Temperature", type: "text" },
      { key: "humidity", label: "Humidity", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
    ],
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Name" },
      { key: "temperature", label: "Temperature" },
      { key: "humidity", label: "Humidity" },
      { key: "isActive", label: "Status" },
    ],
  },
  units: {
    collection: COLLECTIONS.units,
    title: "Unit Master",
    singular: "Unit",
    description: "Units of measure used across tests and specifications.",
    fields: [
      { key: "code", label: "Code", type: "text", required: true },
      { key: "name", label: "Name", type: "text", required: true, searchable: true },
      { key: "symbol", label: "Symbol", type: "text", required: true },
      { key: "description", label: "Description", type: "textarea" },
    ],
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Name" },
      { key: "symbol", label: "Symbol" },
      { key: "isActive", label: "Status" },
    ],
  },
  methods: {
    collection: COLLECTIONS.methods,
    title: "Method Master",
    singular: "Method",
    description: "Analytical methods and SOP references.",
    fields: [
      { key: "code", label: "Code", type: "text", required: true },
      { key: "name", label: "Name", type: "text", required: true, searchable: true },
      { key: "version", label: "Version", type: "text" },
      { key: "sopReference", label: "SOP Reference", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
    ],
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Name" },
      { key: "version", label: "Version" },
      { key: "sopReference", label: "SOP" },
      { key: "isActive", label: "Status" },
    ],
  },
  instruments: {
    collection: COLLECTIONS.instruments,
    title: "Instrument Master",
    singular: "Instrument",
    description: "Laboratory instruments, calibration, and availability.",
    fields: [
      { key: "code", label: "Code", type: "text", required: true },
      { key: "name", label: "Name", type: "text", required: true, searchable: true },
      { key: "manufacturer", label: "Manufacturer", type: "text" },
      { key: "model", label: "Model", type: "text" },
      { key: "serialNumber", label: "Serial Number", type: "text" },
      { key: "calibrationDue", label: "Calibration Due", type: "date" },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: [
          { label: "Available", value: "available" },
          { label: "In Use", value: "in_use" },
          { label: "Maintenance", value: "maintenance" },
          { label: "Retired", value: "retired" },
        ],
      },
    ],
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Name" },
      { key: "manufacturer", label: "Manufacturer" },
      { key: "calibrationDue", label: "Calibration Due" },
      { key: "status", label: "Status" },
    ],
  },
  specifications: {
    collection: COLLECTIONS.specifications,
    title: "Specification Master",
    singular: "Specification",
    description: "Product specifications and acceptance criteria sets.",
    fields: [
      { key: "code", label: "Code", type: "text", required: true },
      { key: "name", label: "Name", type: "text", required: true, searchable: true },
      { key: "version", label: "Version", type: "text" },
      { key: "effectiveDate", label: "Effective Date", type: "date" },
      { key: "description", label: "Description", type: "textarea" },
    ],
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Name" },
      { key: "version", label: "Version" },
      { key: "effectiveDate", label: "Effective Date" },
      { key: "isActive", label: "Status" },
    ],
  },
  "test-masters": {
    collection: COLLECTIONS.testMasters,
    title: "Test Master",
    singular: "Test",
    description: "Define analytical tests and their parameters.",
    fields: [
      { key: "code", label: "Code", type: "text", required: true },
      { key: "name", label: "Name", type: "text", required: true, searchable: true },
      { key: "category", label: "Category", type: "text" },
      { key: "estimatedHours", label: "Estimated Hours", type: "number" },
      { key: "description", label: "Description", type: "textarea" },
    ],
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Name" },
      { key: "category", label: "Category" },
      { key: "estimatedHours", label: "Est. Hours" },
      { key: "isActive", label: "Status" },
    ],
  },
};

export const NAV_ITEMS = [
  {
    title: "Overview",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
      { title: "Search", href: "/search", icon: "Search" },
      { title: "Notifications", href: "/notifications", icon: "Bell" },
    ],
  },
  {
    title: "Operations",
    items: [
      { title: "Samples", href: "/samples", icon: "FlaskConical" },
      { title: "Testing", href: "/testing", icon: "TestTube2" },
      { title: "Reports", href: "/reports", icon: "FileText" },
      { title: "Approvals", href: "/approvals", icon: "CheckCircle2" },
    ],
  },
  {
    title: "Masters",
    items: [
      { title: "Departments", href: "/masters/departments", icon: "Building2" },
      { title: "Laboratories", href: "/masters/laboratories", icon: "Microscope" },
      { title: "Products", href: "/masters/products", icon: "Package" },
      { title: "Customers", href: "/masters/customers", icon: "Users" },
      { title: "Materials", href: "/masters/materials", icon: "Boxes" },
      { title: "Tests", href: "/masters/test-masters", icon: "ClipboardList" },
      { title: "Instruments", href: "/masters/instruments", icon: "Cpu" },
      { title: "Specifications", href: "/masters/specifications", icon: "BookMarked" },
      { title: "Methods", href: "/masters/methods", icon: "BookOpen" },
      { title: "Units", href: "/masters/units", icon: "Ruler" },
      { title: "Sample Types", href: "/masters/sample-types", icon: "Tags" },
      { title: "Storage", href: "/masters/storage-conditions", icon: "Thermometer" },
    ],
  },
  {
    title: "Administration",
    items: [
      { title: "Users", href: "/users", icon: "UserCog", roles: ["admin"] as UserRole[] },
      { title: "Activity Logs", href: "/activities", icon: "Activity" },
      { title: "Audit Trail", href: "/audit-trail", icon: "ShieldCheck" },
      { title: "Settings", href: "/settings", icon: "Settings" },
    ],
  },
] as const;
