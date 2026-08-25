import { Suspense } from "react";
import PortalShell from "@/components/portal/PortalShell";

export default function PortalRoute() {
  return (
    <Suspense>
      <PortalShell />
    </Suspense>
  );
}
