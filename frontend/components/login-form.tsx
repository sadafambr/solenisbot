"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { useUserStore } from "@/store/user"
import api from "@/lib/axiosInstance"
import { Loader2 } from "lucide-react"

export default function LoginForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const { update } = useUserStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await api.post("/auth/login", {
        email,
        password
      })
      const user: any = {
        id: response.data.user_id,
        token: response.data.access_token,
        refToken: response.data.refresh_token,
        firstName: response.data.first_name,
        lastName: response.data.last_name,
        email: response.data.email,
        };
      update(user);
      router.push("/")
    } catch (error) {
      console.error("Login failed:", error)
      alert("Login failed. Please check your credentials.")
    }
  }

  return (
    <Card className="rounded-2xl border border-white/80 bg-white/55 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] backdrop-blur-2xl">
      <CardHeader className="space-y-1 pb-6">
        <div className="text-center">
          <p className="text-lg font-semibold tracking-tight text-neutral-950">{"FP&A Chatbot"}</p>
          <p className="mt-1 text-sm text-neutral-600">Sign in to continue</p>
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Button variant="link" className="h-auto p-0 text-sm">
                Forgot password?
              </Button>
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

