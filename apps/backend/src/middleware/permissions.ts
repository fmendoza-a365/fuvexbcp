const SALES_ROLES = ['SUPERADMIN', 'GERENTE', 'JEFE_ZONAL', 'SUPERVISOR', 'VENDEDOR'] as const;
const OPS_ROLES = ['SUPERADMIN', 'GERENTE', 'BACK_OFFICE'] as const;
const REVIEW_ROLES = ['SUPERADMIN', 'GERENTE', 'JEFE_ZONAL', 'SUPERVISOR', 'BACK_OFFICE', 'ANALISTA'] as const;
const LEADERSHIP_ROLES = ['SUPERADMIN', 'GERENTE', 'JEFE_ZONAL', 'SUPERVISOR'] as const;

export const ACTION_ROLES = {
  CREATE_SALE: SALES_ROLES,
  UPLOAD_DOCUMENT: ['SUPERADMIN', 'GERENTE', 'JEFE_ZONAL', 'SUPERVISOR', 'BACK_OFFICE', 'ANALISTA', 'VENDEDOR'],
  INVALIDATE_DOCUMENT: REVIEW_ROLES,
  MANAGE_CONVENIO: OPS_ROLES,
  MANAGE_BCP: OPS_ROLES,
  MANAGE_REASSIGNMENT: LEADERSHIP_ROLES,
  DELETE_SALE: ['SUPERADMIN', 'GERENTE']
} as const;

export type PermissionAction = keyof typeof ACTION_ROLES;

export const canPerformAction = (role: string | undefined, action: PermissionAction) => {
  if (!role) return false;
  return (ACTION_ROLES[action] as readonly string[]).includes(role);
};

export const requireAction = (action: PermissionAction) => {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    if (!canPerformAction(req.user.role, action)) {
      return res.status(403).json({
        error: 'No tienes permisos para realizar esta accion',
        action,
        roles_permitidos: ACTION_ROLES[action]
      });
    }

    next();
  };
};
