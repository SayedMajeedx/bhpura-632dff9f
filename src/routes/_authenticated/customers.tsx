import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/customers")({
  beforeLoad: () => { throw redirect({ to: "/dashboard" }); },
});
