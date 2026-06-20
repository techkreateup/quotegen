import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";

export async function checkAndTriggerWorkflow(params: {
  module: string;
  trigger: string;
  entityId: string;
  entityType: string;
  userId: string;
  userRoleId: string;
}): Promise<{ triggered: boolean; instanceId?: string }> {
  const workflow = await prisma.workflow.findFirst({
    where: { module: params.module, trigger: params.trigger },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  });

  if (!workflow || !workflow.isActive || workflow.steps.length === 0) {
    return { triggered: false };
  }

  if (workflow.triggerRoleIds.length > 0 && !workflow.triggerRoleIds.includes(params.userRoleId)) {
    return { triggered: false };
  }

  const instance = await prisma.workflowInstance.create({
    data: {
      companyId: requireCompanyId(),
      workflowId: workflow.id,
      entityId: params.entityId,
      entityType: params.entityType,
      status: "pending",
      currentStep: 1,
      initiatedBy: params.userId,
    },
  });

  return { triggered: true, instanceId: instance.id };
}

export async function getApproverIdsForStep(step: {
  approverType: string;
  approverRoleId: string | null;
  approverUserId: string | null;
}): Promise<string[]> {
  if (step.approverType === "user" && step.approverUserId) {
    return [step.approverUserId];
  }
  if (step.approverType === "role" && step.approverRoleId) {
    const users = await prisma.user.findMany({
      where: { roleId: step.approverRoleId, isActive: true },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }
  return [];
}

export async function processApproval(params: {
  instanceId: string;
  approverId: string;
  decision: "approved" | "rejected";
  comments?: string;
}): Promise<{ status: string; nextStep?: number }> {
  const instance = await prisma.workflowInstance.findUnique({
    where: { id: params.instanceId },
    include: { workflow: { include: { steps: { orderBy: { stepOrder: "asc" } } } } },
  });

  if (!instance || instance.status !== "pending") {
    throw new Error("Invalid or already completed workflow instance");
  }

  await prisma.workflowApproval.create({
    data: {
      instanceId: params.instanceId,
      stepOrder: instance.currentStep,
      approverId: params.approverId,
      decision: params.decision,
      comments: params.comments || null,
    },
  });

  if (params.decision === "rejected") {
    await prisma.workflowInstance.update({
      where: { id: params.instanceId },
      data: { status: "rejected", completedAt: new Date() },
    });
    return { status: "rejected" };
  }

  const totalSteps = instance.workflow.steps.length;
  if (instance.currentStep >= totalSteps) {
    await prisma.workflowInstance.update({
      where: { id: params.instanceId },
      data: { status: "approved", completedAt: new Date() },
    });
    await resolveEntityStatus(instance.entityType, instance.entityId, "approved");
    return { status: "approved" };
  }

  const nextStep = instance.currentStep + 1;
  await prisma.workflowInstance.update({
    where: { id: params.instanceId },
    data: { currentStep: nextStep },
  });
  return { status: "pending", nextStep };
}

export async function getPendingApprovalsForUser(userId: string): Promise<unknown[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, roleId: true },
  });
  if (!user) return [];

  const instances = await prisma.workflowInstance.findMany({
    where: { status: "pending" },
    include: {
      workflow: { include: { steps: { orderBy: { stepOrder: "asc" } } } },
      approvals: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const pending: unknown[] = [];
  for (const inst of instances) {
    const currentStepDef = inst.workflow.steps.find((s) => s.stepOrder === inst.currentStep);
    if (!currentStepDef) continue;

    const alreadyDecided = inst.approvals.some(
      (a) => a.stepOrder === inst.currentStep && a.approverId === userId
    );
    if (alreadyDecided) continue;

    let isApprover = false;
    if (currentStepDef.approverType === "user" && currentStepDef.approverUserId === userId) {
      isApprover = true;
    } else if (currentStepDef.approverType === "role" && currentStepDef.approverRoleId === user.roleId) {
      isApprover = true;
    }

    if (isApprover) {
      pending.push({
        ...inst,
        currentStepName: currentStepDef.name,
      });
    }
  }
  return pending;
}

async function resolveEntityStatus(entityType: string, entityId: string, decision: "approved" | "rejected") {
  if (decision !== "approved") return;
  try {
    if (entityType === "quotations") {
      await prisma.quotation.update({ where: { id: entityId }, data: { status: "Draft" } });
    } else if (entityType === "invoices") {
      await prisma.invoice.update({ where: { id: entityId }, data: { status: "Unpaid" } });
    }
  } catch {}
}
