import { LoginForm } from "@/components/login-form";

interface LoginPageProps {
  searchParams?: Promise<{
    redirect?: string | string[];
  }>;
}

export default async function Page({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const redirectParam = resolvedSearchParams?.redirect;
  const redirectPath =
    typeof redirectParam === "string" &&
    redirectParam.startsWith("/") &&
    !redirectParam.startsWith("//")
      ? redirectParam
      : undefined;

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm redirectPath={redirectPath} />
      </div>
    </div>
  );
}
