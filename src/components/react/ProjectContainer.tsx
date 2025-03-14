import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { ProjectSidebar } from "@/components/react/ProjectSidebar"
import { useStore } from '@nanostores/react'
import { isSidebarOpen } from "@/lib/stores"
import { Toaster } from "sonner"

// import { useBasicSync } from '@/lib/stores';

export default function Layout({ children }: { children: React.ReactNode }) {
  // useBasicSync();
  return (
    <SidebarProvider defaultOpen={useStore(isSidebarOpen)}>
      <ProjectSidebar />
      <SidebarInset className="">
        <Toaster />
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
