import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/campaigns")({
  beforeLoad: () => { throw redirect({ to: "/dashboard" }); },
});
