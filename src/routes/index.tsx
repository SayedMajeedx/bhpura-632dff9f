import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    // /dashboard is the smart redirector — it sends users to their brand workspace.
    throw redirect({ to: "/dashboard" });
  },
});
