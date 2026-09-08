import PostsList from "@/components/admin/marketing/PostsList";

export const dynamic = "force-dynamic";

export default function FailedPage() {
  return <PostsList failedOnly />;
}