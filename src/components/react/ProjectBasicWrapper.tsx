import { BasicProvider } from '@basictech/react';
import { schema } from '@/basic.config'

import { ProjectWorkspace } from "@/components/ProjectWorkspace";
import ProjectContainer from "@/components/react/ProjectContainer";

export function ProjectBasicWrapper({ children }: { children: React.ReactNode }) {
  return (
    <BasicProvider project_id={schema.project_id} schema={schema}>
      <ProjectContainer>
        <div className="">
          <ProjectWorkspace />
        </div>
      </ProjectContainer>
    </BasicProvider>
  )
} 