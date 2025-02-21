import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { ProjectSidebar } from "@/components/react/ProjectSidebar"

import { useStore } from '@nanostores/react'
import { isSidebarOpen } from "@/lib/stores"

console.log('sidebar state', isSidebarOpen.get())

// export function CustomTrigger() {
//   const { toggleSidebar } = useSidebar()
  
//   const handleClick = () => {
//     toggleSidebar();
//     isSidebarOpen.set(!isSidebarOpen.get());
//   }
  
//   return <button onClick={handleClick}>Toggle Sidebar</button>
// }


export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={useStore(isSidebarOpen)}>
      <ProjectSidebar />
      <SidebarInset>
        <main>
          <SidebarTrigger className="m-2 p-2 relative top-[1.5px]" />
          {/* <div>Sidebar state: {String(isSidebarOpen.get())}</div> */}
          {children}
          </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
