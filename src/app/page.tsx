import { Suspense } from "react";
import ClientLayout from "@/components/ClientLayout";

export default function Home() {
  return (
    <Suspense>
      <ClientLayout />
    </Suspense>
  );
}
