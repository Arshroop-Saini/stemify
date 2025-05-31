"use client"

import * as React from "react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // useEffect only runs on the client, so now we can safely show the UI
  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  const isDark = theme === "dark"

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="group relative inline-flex items-center justify-center rounded-full text-sm font-medium transition-all duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none hover:bg-surface-light/50 dark:hover:bg-surface-dark/50 hover:scale-110 active:scale-95 h-10 w-10 text-foreground overflow-hidden"
      aria-label="Toggle theme"
    >
      {/* Sun Icon - Visible in Dark Mode */}
      <svg
        className={`absolute h-[1.4rem] w-[1.4rem] transition-all duration-700 ease-in-out transform group-hover:scale-110 ${
          isDark 
            ? 'opacity-100 rotate-0 scale-100' 
            : 'opacity-0 rotate-90 scale-50'
        }`}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
      
      {/* Moon Icon - Visible in Light Mode */}
      <svg
        className={`absolute h-[1.4rem] w-[1.4rem] transition-all duration-700 ease-in-out transform group-hover:scale-110 ${
          !isDark 
            ? 'opacity-100 rotate-0 scale-100' 
            : 'opacity-0 -rotate-90 scale-50'
        }`}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
      
      {/* Subtle glow effect on hover with smooth transition */}
      <div className="absolute inset-0 rounded-full bg-accent/20 opacity-0 group-hover:opacity-100 transition-all duration-500 ease-out blur-sm scale-75 group-hover:scale-100" />
      
      {/* Additional rotating ring effect for extra smoothness */}
      <div className={`absolute inset-0 rounded-full border border-accent/20 transition-all duration-1000 ease-in-out ${
        isDark ? 'rotate-180 scale-110' : 'rotate-0 scale-100'
      } opacity-0 group-hover:opacity-30`} />
    </button>
  )
} 