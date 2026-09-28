import Link from "next/link";
import { PageTemplate } from "@/components/templates/page-template";

export default function NotFoundPage() {
  return (
    <PageTemplate
      title="Page not found"
      description="The page may have moved or may not be available for this user role."
    >
      <Link href="/">Return to ReefCare MY home</Link>
    </PageTemplate>
  );
}
