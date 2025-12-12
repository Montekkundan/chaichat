"use client";

import { LayoutMain } from '~/components/chat/layout-chat';
import { FlowProvider } from '~/lib/providers/flow-provider';
import { FlowCanvas } from '~/components/flow';
import { ReactFlowProvider } from '@xyflow/react';

export default function FlowPage() {
  return (
    <LayoutMain>
      <FlowProvider>
        <ReactFlowProvider>
          <FlowCanvas />
        </ReactFlowProvider>
      </FlowProvider>
    </LayoutMain>
  );
}