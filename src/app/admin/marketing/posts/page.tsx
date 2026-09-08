import PostsList from "@/components/admin/marketing/PostsList";

export const dynamic = "force-dynamic";

export default function PostsPage() {
  return <PostsList failedOnly={false} />;
}