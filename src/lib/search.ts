import { COLLECTIONS } from "@/lib/constants";
import type {
  Customer,
  Department,
  Instrument,
  LabTest,
  Laboratory,
  Material,
  Method,
  Product,
  Report,
  Sample,
  SampleType,
  Specification,
  StorageCondition,
  TestMaster,
  Unit,
} from "@/types";

export const SEARCH_FETCH_LIMIT = 5000;
export const MIN_SEARCH_LENGTH = 2;
export const SEARCH_RESULT_PREVIEW = 8;

export function normalizeSearchQuery(query: string) {
  return query.trim().toLowerCase();
}

export function includesQuery(value: string | undefined | null, query: string) {
  return (value || "").toLowerCase().includes(query);
}

export function isActiveRecord<T extends { isActive?: boolean }>(item: T) {
  return item.isActive !== false;
}

export function matchSample(sample: Sample, query: string) {
  return (
    includesQuery(sample.sampleNumber, query) ||
    includesQuery(sample.productName, query) ||
    includesQuery(sample.batchNumber, query) ||
    includesQuery(sample.lotNumber, query) ||
    includesQuery(sample.barcode, query) ||
    includesQuery(sample.customerName, query) ||
    includesQuery(sample.assignedAnalystName, query) ||
    includesQuery(sample.storageConditionName, query)
  );
}

export function matchTest(test: LabTest, query: string) {
  return (
    includesQuery(test.testNumber, query) ||
    includesQuery(test.testName, query) ||
    includesQuery(test.sampleNumber, query) ||
    includesQuery(test.analystName, query)
  );
}

export function matchReport(report: Report, query: string) {
  return (
    includesQuery(report.reportNumber, query) ||
    includesQuery(report.title, query) ||
    includesQuery(report.sampleNumber, query)
  );
}

export function matchCodeNameEntity(
  entity: { code?: string; name?: string },
  query: string
) {
  return includesQuery(entity.name, query) || includesQuery(entity.code, query);
}

export function matchProduct(product: Product, query: string) {
  return (
    matchCodeNameEntity(product, query) ||
    includesQuery(product.dosageForm, query) ||
    includesQuery(product.strength, query) ||
    includesQuery(product.customerName, query) ||
    includesQuery(product.description, query)
  );
}

export function matchMaterial(material: Material, query: string) {
  return (
    matchCodeNameEntity(material, query) ||
    includesQuery(material.type, query) ||
    includesQuery(material.casNumber, query) ||
    includesQuery(material.supplier, query) ||
    includesQuery(material.description, query)
  );
}

export function matchInstrument(instrument: Instrument, query: string) {
  return (
    matchCodeNameEntity(instrument, query) ||
    includesQuery(instrument.manufacturer, query) ||
    includesQuery(instrument.model, query) ||
    includesQuery(instrument.serialNumber, query) ||
    includesQuery(instrument.laboratoryName, query) ||
    includesQuery(instrument.status, query)
  );
}

export function matchMethod(method: Method, query: string) {
  return (
    matchCodeNameEntity(method, query) ||
    includesQuery(method.version, query) ||
    includesQuery(method.category, query) ||
    includesQuery(method.sopReference, query) ||
    includesQuery(method.description, query)
  );
}

export function matchUnit(unit: Unit, query: string) {
  return (
    matchCodeNameEntity(unit, query) ||
    includesQuery(unit.symbol, query) ||
    includesQuery(unit.category, query) ||
    includesQuery(unit.description, query)
  );
}

export function matchSampleType(sampleType: SampleType, query: string) {
  return (
    matchCodeNameEntity(sampleType, query) ||
    includesQuery(sampleType.category, query) ||
    includesQuery(sampleType.description, query) ||
    (sampleType.retentionDays != null &&
      String(sampleType.retentionDays).includes(query))
  );
}

export function matchStorageCondition(
  condition: StorageCondition,
  query: string
) {
  return (
    matchCodeNameEntity(condition, query) ||
    includesQuery(condition.category, query) ||
    includesQuery(condition.temperature, query) ||
    includesQuery(condition.humidity, query) ||
    includesQuery(condition.description, query)
  );
}

export function matchDepartment(department: Department, query: string) {
  return (
    matchCodeNameEntity(department, query) ||
    includesQuery(department.head, query)
  );
}

export function matchLaboratory(laboratory: Laboratory, query: string) {
  return (
    matchCodeNameEntity(laboratory, query) ||
    includesQuery(laboratory.location, query) ||
    includesQuery(laboratory.accreditation, query) ||
    includesQuery(laboratory.departmentName, query) ||
    includesQuery(laboratory.contactEmail, query)
  );
}

export function matchTestMaster(testMaster: TestMaster, query: string) {
  return (
    matchCodeNameEntity(testMaster, query) ||
    includesQuery(testMaster.category, query) ||
    includesQuery(testMaster.methodName, query) ||
    includesQuery(testMaster.instrumentName, query) ||
    includesQuery(testMaster.description, query) ||
    (testMaster.parameters || []).some(
      (param) =>
        includesQuery(param.name, query) || includesQuery(param.unit, query)
    )
  );
}

export function matchSpecification(specification: Specification, query: string) {
  return (
    matchCodeNameEntity(specification, query) ||
    includesQuery(specification.version, query) ||
    includesQuery(specification.productName, query) ||
    includesQuery(specification.description, query)
  );
}

export function matchCustomer(customer: Customer, query: string) {
  return (
    matchCodeNameEntity(customer, query) ||
    includesQuery(customer.contactPerson, query) ||
    includesQuery(customer.email, query) ||
    includesQuery(customer.phone, query) ||
    includesQuery(customer.address, query)
  );
}

export interface SearchCatalog {
  samples: Sample[];
  tests: LabTest[];
  reports: Report[];
  products: Product[];
  customers: Customer[];
  materials: Material[];
  instruments: Instrument[];
  methods: Method[];
  departments: Department[];
  laboratories: Laboratory[];
  testMasters: TestMaster[];
  specifications: Specification[];
  units: Unit[];
  sampleTypes: SampleType[];
  storageConditions: StorageCondition[];
}

export interface SearchResultGroup {
  title: string;
  href: string;
  items: { id: string; label: string; meta?: string }[];
}

export function buildSearchResults(
  catalog: SearchCatalog,
  rawQuery: string
): SearchResultGroup[] {
  const query = normalizeSearchQuery(rawQuery);
  if (query.length < MIN_SEARCH_LENGTH) return [];

  const groups: SearchResultGroup[] = [
    {
      title: "Samples",
      href: "/samples",
      items: catalog.samples
        .filter((item) => isActiveRecord(item) && matchSample(item, query))
        .map((item) => ({
          id: item.id,
          label: item.sampleNumber,
          meta: item.productName || item.customerName,
        })),
    },
    {
      title: "Tests",
      href: "/testing",
      items: catalog.tests
        .filter((item) => isActiveRecord(item) && matchTest(item, query))
        .map((item) => ({
          id: item.id,
          label: item.testNumber,
          meta: item.testName,
        })),
    },
    {
      title: "Reports",
      href: "/reports",
      items: catalog.reports
        .filter((item) => isActiveRecord(item) && matchReport(item, query))
        .map((item) => ({
          id: item.id,
          label: item.reportNumber,
          meta: item.title,
        })),
    },
    {
      title: "Products",
      href: "/masters/products",
      items: catalog.products
        .filter((item) => isActiveRecord(item) && matchProduct(item, query))
        .map((item) => ({
          id: item.id,
          label: item.name,
          meta: [item.code, item.dosageForm, item.strength].filter(Boolean).join(" · "),
        })),
    },
    {
      title: "Customers",
      href: "/masters/customers",
      items: catalog.customers
        .filter((item) => isActiveRecord(item) && matchCustomer(item, query))
        .map((item) => ({
          id: item.id,
          label: item.name,
          meta: [item.code, item.contactPerson, item.email].filter(Boolean).join(" · "),
        })),
    },
    {
      title: "Materials",
      href: "/masters/materials",
      items: catalog.materials
        .filter((item) => isActiveRecord(item) && matchMaterial(item, query))
        .map((item) => ({
          id: item.id,
          label: item.name,
          meta: [item.code, item.type, item.casNumber].filter(Boolean).join(" · "),
        })),
    },
    {
      title: "Test Masters",
      href: "/masters/test-masters",
      items: catalog.testMasters
        .filter((item) => isActiveRecord(item) && matchTestMaster(item, query))
        .map((item) => ({
          id: item.id,
          label: item.name,
          meta: [
            item.code,
            item.category,
            item.parameters?.length ? `${item.parameters.length} params` : undefined,
          ]
            .filter(Boolean)
            .join(" · "),
        })),
    },
    {
      title: "Instruments",
      href: "/masters/instruments",
      items: catalog.instruments
        .filter((item) => isActiveRecord(item) && matchInstrument(item, query))
        .map((item) => ({
          id: item.id,
          label: item.name,
          meta: [item.code, item.manufacturer, item.laboratoryName]
            .filter(Boolean)
            .join(" · "),
        })),
    },
    {
      title: "Specifications",
      href: "/masters/specifications",
      items: catalog.specifications
        .filter((item) => isActiveRecord(item) && matchSpecification(item, query))
        .map((item) => ({
          id: item.id,
          label: item.name,
          meta: [
            item.code,
            item.version ? `v${item.version}` : undefined,
            item.productName,
            item.testIds?.length ? `${item.testIds.length} tests` : undefined,
          ]
            .filter(Boolean)
            .join(" · "),
        })),
    },
    {
      title: "Methods",
      href: "/masters/methods",
      items: catalog.methods
        .filter((item) => isActiveRecord(item) && matchMethod(item, query))
        .map((item) => ({
          id: item.id,
          label: item.name,
          meta: [item.code, item.version ? `v${item.version}` : undefined, item.category]
            .filter(Boolean)
            .join(" · "),
        })),
    },
    {
      title: "Units",
      href: "/masters/units",
      items: catalog.units
        .filter((item) => isActiveRecord(item) && matchUnit(item, query))
        .map((item) => ({
          id: item.id,
          label: item.name,
          meta: [item.symbol, item.code, item.category].filter(Boolean).join(" · "),
        })),
    },
    {
      title: "Sample Types",
      href: "/masters/sample-types",
      items: catalog.sampleTypes
        .filter((item) => isActiveRecord(item) && matchSampleType(item, query))
        .map((item) => ({
          id: item.id,
          label: item.name,
          meta: [
            item.code,
            item.category,
            item.retentionDays != null ? `${item.retentionDays}d` : undefined,
          ]
            .filter(Boolean)
            .join(" · "),
        })),
    },
    {
      title: "Storage Conditions",
      href: "/masters/storage-conditions",
      items: catalog.storageConditions
        .filter((item) => isActiveRecord(item) && matchStorageCondition(item, query))
        .map((item) => ({
          id: item.id,
          label: item.name,
          meta: [item.code, item.temperature, item.humidity]
            .filter(Boolean)
            .join(" · "),
        })),
    },
    {
      title: "Departments",
      href: "/masters/departments",
      items: catalog.departments
        .filter((item) => isActiveRecord(item) && matchDepartment(item, query))
        .map((item) => ({ id: item.id, label: item.name, meta: item.code })),
    },
    {
      title: "Laboratories",
      href: "/masters/laboratories",
      items: catalog.laboratories
        .filter((item) => isActiveRecord(item) && matchLaboratory(item, query))
        .map((item) => ({
          id: item.id,
          label: item.name,
          meta: [item.code, item.departmentName].filter(Boolean).join(" · "),
        })),
    },
  ];

  return groups.filter((group) => group.items.length > 0);
}

export async function fetchSearchCatalog(): Promise<SearchCatalog> {
  const { listDocumentsSafe } = await import("@/lib/firebase/firestore");

  const [
    samples,
    tests,
    reports,
    products,
    customers,
    materials,
    instruments,
    methods,
    departments,
    laboratories,
    testMasters,
    specifications,
    units,
    sampleTypes,
    storageConditions,
  ] = await Promise.all([
    listDocumentsSafe<Sample>(COLLECTIONS.samples, [], SEARCH_FETCH_LIMIT),
    listDocumentsSafe<LabTest>(COLLECTIONS.tests, [], SEARCH_FETCH_LIMIT),
    listDocumentsSafe<Report>(COLLECTIONS.reports, [], SEARCH_FETCH_LIMIT),
    listDocumentsSafe<Product>(COLLECTIONS.products, [], SEARCH_FETCH_LIMIT),
    listDocumentsSafe<Customer>(COLLECTIONS.customers, [], SEARCH_FETCH_LIMIT),
    listDocumentsSafe<Material>(COLLECTIONS.materials, [], SEARCH_FETCH_LIMIT),
    listDocumentsSafe<Instrument>(COLLECTIONS.instruments, [], SEARCH_FETCH_LIMIT),
    listDocumentsSafe<Method>(COLLECTIONS.methods, [], SEARCH_FETCH_LIMIT),
    listDocumentsSafe<Department>(COLLECTIONS.departments, [], SEARCH_FETCH_LIMIT),
    listDocumentsSafe<Laboratory>(COLLECTIONS.laboratories, [], SEARCH_FETCH_LIMIT),
    listDocumentsSafe<TestMaster>(COLLECTIONS.testMasters, [], SEARCH_FETCH_LIMIT),
    listDocumentsSafe<Specification>(COLLECTIONS.specifications, [], SEARCH_FETCH_LIMIT),
    listDocumentsSafe<Unit>(COLLECTIONS.units, [], SEARCH_FETCH_LIMIT),
    listDocumentsSafe<SampleType>(COLLECTIONS.sampleTypes, [], SEARCH_FETCH_LIMIT),
    listDocumentsSafe<StorageCondition>(
      COLLECTIONS.storageConditions,
      [],
      SEARCH_FETCH_LIMIT
    ),
  ]);

  return {
    samples,
    tests,
    reports,
    products,
    customers,
    materials,
    instruments,
    methods,
    departments,
    laboratories,
    testMasters,
    specifications,
    units,
    sampleTypes,
    storageConditions,
  };
}
