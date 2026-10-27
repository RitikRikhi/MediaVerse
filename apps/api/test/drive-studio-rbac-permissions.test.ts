import { describe, it, expect, beforeAll } from 'vitest';
import { DriveService } from '../src/services/driveService';
import { db } from '../src/db/memoryStore';

describe('Drive Studio RBAC & Access Delegation System', () => {
  const superAdmin = {
    id: 'super-admin-01',
    full_name: 'Prof. Rajesh Sharma',
    email: 'admin@dsa.cgc.edu.in'
  };

  beforeAll(() => {
    DriveService.init();
  });

  it('should auto-store user in Drive Studio with role-tailored Google Drive when a user is provisioned/registered', async () => {
    const newUser = {
      id: 'test-user-karan-photo-01',
      full_name: 'Karan Mehra',
      email: 'karan.photo@dsa.cgc.edu.in',
      roles: ['PHOTOGRAPHER' as const]
    };

    // Provision personal user drive (as triggered on registration)
    const personalDrive = await DriveService.provisionPersonalUserDrive(newUser);
    expect(personalDrive.personalRootFolderId).toBeTruthy();

    // Verify user is immediately stored in Drive Studio memberDrives
    const allDrives = DriveService.getAllMemberDrives();
    const storedDrive = allDrives.find(d => d.memberEmail.toLowerCase() === newUser.email.toLowerCase());

    expect(storedDrive).toBeDefined();
    expect(storedDrive?.memberName).toBe('Karan Mehra');
    expect(storedDrive?.role).toBe('PHOTOGRAPHER');
    expect(storedDrive?.accessLevel).toBe('writer'); // Default editor access
    expect(storedDrive?.subfolders.length).toBeGreaterThanOrEqual(5);

    // Verify photography folder isolation (strictly RAW Photos & Stills)
    const subNames = storedDrive?.subfolders.map(s => s.name) || [];
    expect(subNames.some(n => n.includes('Keynotes') || n.includes('RAW Photos'))).toBe(true);
    expect(subNames.some(n => n.includes('Concert') || n.includes('Selects'))).toBe(true);
  }, 30000);

  it('should allow Super Admin to grant Download-Only (reader) access of one person\'s drive to another member', async () => {
    const drives = DriveService.getAllMemberDrives();
    const targetDrive = drives[0];
    expect(targetDrive).toBeDefined();

    // Super Admin gives Simran "Download Only (reader)" access to the member's Photography drive
    const targetEmail = 'simran.viewer@dsa.cgc.edu.in';
    const targetName = 'Simran Kaur';

    const updatedDrive = await DriveService.grantDriveAccessToUser({
      driveId: targetDrive.id,
      targetEmail,
      targetName,
      role: 'reader',
      adminUser: superAdmin
    });

    expect(updatedDrive.grantedPermissions).toBeDefined();
    const simranPerm = updatedDrive.grantedPermissions?.find(p => p.email === targetEmail);
    expect(simranPerm).toBeDefined();
    expect(simranPerm?.role).toBe('reader'); // Strictly Download Only / Viewer
    expect(simranPerm?.name).toBe('Simran Kaur');
    expect(simranPerm?.grantedBy).toBe(superAdmin.full_name);
  });

  it('should allow Super Admin to grant Full Editor (writer) access to a collaborator', async () => {
    const drives = DriveService.getAllMemberDrives();
    const targetDrive = drives[0];
    expect(targetDrive).toBeDefined();

    const editorEmail = 'lead.editor@dsa.cgc.edu.in';
    const editorName = 'Lead Editor Rahul';

    const updatedDrive = await DriveService.grantDriveAccessToUser({
      driveId: targetDrive.id,
      targetEmail: editorEmail,
      targetName: editorName,
      role: 'writer',
      adminUser: superAdmin
    });

    const rahulPerm = updatedDrive.grantedPermissions?.find(p => p.email === editorEmail);
    expect(rahulPerm).toBeDefined();
    expect(rahulPerm?.role).toBe('writer'); // Full Editor
  });

  it('should allow Super Admin to switch owner primary access level between Editor and Download Only', async () => {
    const drives = DriveService.getAllMemberDrives();
    const drive = drives[0];

    // 1. Switch to reader (Download Only)
    const readOnlyDrive = await DriveService.updateMemberDriveAccessLevel({
      driveId: drive.id,
      newAccessLevel: 'reader',
      adminUser: superAdmin
    });
    expect(readOnlyDrive.accessLevel).toBe('reader');

    // 2. Switch back to writer (Full Editor)
    const editorDrive = await DriveService.updateMemberDriveAccessLevel({
      driveId: drive.id,
      newAccessLevel: 'writer',
      adminUser: superAdmin
    });
    expect(editorDrive.accessLevel).toBe('writer');
  });

  it('should allow Super Admin to revoke delegated drive access cleanly', async () => {
    const drives = DriveService.getAllMemberDrives();
    const targetDrive = drives[0];
    expect(targetDrive).toBeDefined();

    const targetEmail = 'simran.viewer@dsa.cgc.edu.in';

    // Verify permission exists before revoke
    expect(targetDrive.grantedPermissions?.some(p => p.email === targetEmail)).toBe(true);

    // Revoke access
    const updatedDrive = await DriveService.revokeDriveAccessFromUser({
      driveId: targetDrive.id,
      targetEmail,
      adminUser: superAdmin
    });

    // Verify permission was removed
    expect(updatedDrive.grantedPermissions?.some(p => p.email === targetEmail)).toBe(false);
  });

  it('should allow Super Admin to delete/remove a member drive from Drive Studio', async () => {
    const drives = DriveService.getAllMemberDrives();
    const driveToDelete = drives[0];
    expect(driveToDelete).toBeDefined();

    const delResult = await DriveService.deleteMemberDrive(driveToDelete.id);
    expect(delResult.success).toBe(true);

    const remaining = DriveService.getAllMemberDrives();
    expect(remaining.some(d => d.id === driveToDelete.id)).toBe(false);
  });
});
