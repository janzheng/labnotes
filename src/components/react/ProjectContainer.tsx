import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { ProjectSidebar } from "@/components/react/ProjectSidebar"
import { useStore } from '@nanostores/react'
import { isSidebarOpen } from "@/lib/stores"

// import { useBasicSync } from '@/lib/stores';

export default function Layout({ children }: { children: React.ReactNode }) {
  // useBasicSync();
  return (
    <SidebarProvider defaultOpen={useStore(isSidebarOpen)}>
      <ProjectSidebar />
      <SidebarInset className="">
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
