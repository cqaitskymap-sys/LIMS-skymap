import type { Metadata } from "next";
import { MasterModulePage } from "@/components/masters/master-module-page";

export const metadata: Metadata = {
  title: "Materials",
};

export default function Page() {
  return <MasterModulePage masterKey="materials" />;
}
