"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

interface LoginFormProps extends React.ComponentProps<"div"> {
  redirectPath?: string;
}

export function LoginForm({
  className,
  redirectPath,
  ...props
}: LoginFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const username = formData.get("username");
    const password = formData.get("password");

    if (typeof username !== "string" || typeof password !== "string") {
      setError("Введите логин и пароль.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        throw new Error("Неверный логин или пароль.");
      }

      const destination = redirectPath || "/dashboard";
      router.replace(destination);
      router.refresh();
    } catch (loginError) {
      if (loginError instanceof Error) {
        setError(loginError.message);
      } else {
        setError("Что-то пошло не так. Попробуйте снова.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Вход в систему</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="username">Логин</FieldLabel>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="admin"
                  defaultValue="admin"
                  autoComplete="username"
                  required
                  disabled={isSubmitting}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Пароль</FieldLabel>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Введите пароль"
                  autoComplete="current-password"
                  required
                  disabled={isSubmitting}
                />
                {error ? (
                  <FieldDescription className="text-sm text-destructive">
                    {error}
                  </FieldDescription>
                ) : (
                  <FieldDescription>
                    Используйте выданные администратору данные.
                  </FieldDescription>
                )}
              </Field>
              <Field>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full"
                >
                  {isSubmitting ? "Входим..." : "Войти"}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
