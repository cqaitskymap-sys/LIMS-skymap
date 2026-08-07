import type { Metadata } from "next";
import { MasterModulePage } from "@/components/masters/master-module-page";

export const metadata: Metadata = {
  title: "Products",
};

export default function Page() {
  return <MasterModulePage masterKey="products" />;
}
