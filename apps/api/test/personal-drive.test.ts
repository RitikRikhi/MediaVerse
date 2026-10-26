import { describe, it, expect, beforeAll } from 'vitest';
import { DriveService } from '../src/services/driveService';
import { db } from '../src/db/memoryStore';

describe('Personal User Drive & High-Speed Upload Pipeline', () => {
  const photographerUser = {
    id: 'test-photographer-arjun-01',
    full_name: 'Arjun Verma',
    email: 'arjun@mediaverse.dsa',
    roles: ['PHOTOGRAPHER' as const]
  };

  const videographerUser = {
    id: 'test-videographer-priya-01',
    full_name: 'Priya Sharma',
    email: 'priya@mediaverse.dsa',
    roles: ['VIDEOGRAPHER' as const]
  };

  const editorUser = {
    id: 'test-editor-rohit-01',
    full_name: 'Rohit Mehta',
    email: 'rohit@mediaverse.dsa',
    roles: ['VIDEO_EDITOR' as const]
  };

  beforeAll(() => {
    DriveService.init();
  });

  it('should auto-provision role-tailored personal drive for photographer with 5 default subfolders', async () => {
    const drive = await DriveService.provisionPersonalUserDrive(photographerUser);

    expect(drive.userId).toBe(photographerUser.id);
    expect(drive.userName).toBe(photographerUser.full_name);
    expect(drive.role).toBe('PHOTOGRAPHER');
    expect(drive.personalRootFolderId).toBeTruthy();
    expect(drive.personalRootFolderUrl).toContain('https://drive.google.com/drive/folders/');
    expect(drive.subfolders.length).toBe(5);

    const subfolderNames = drive.subfolders.map(s => s.name);
    expect(subfolderNames).toContain('01 - Day 1 Morning (RAW & Stills)');
    expect(subfolderNames).toContain('02 - Day 1 Evening Rock Concert (RAW & Stills)');
    expect(subfolderNames).toContain('03 - Day 2 Tech Arena & Hackathon');
    expect(subfolderNames).toContain('04 - Day 2 Valedictory & Trophy Lift');
    expect(subfolderNames).toContain('05 - Highlights & Selects (High-Res JPG)');
  }, 30000);

  it('should auto-provision role-tailored personal drive for videographer with 4K video subfolders', async () => {
    const drive = await DriveService.provisionPersonalUserDrive(videographerUser);

    expect(drive.role).toBe('VIDEOGRAPHER');
    expect(drive.subfolders.length).toBe(5);

    const subfolderNames = drive.subfolders.map(s => s.name);
    expect(subfolderNames).toContain('01 - Day 1 Morning (4K B-Roll & Stems)');
    expect(subfolderNames).toContain('02 - Day 1 Rock Concert Multi-Cam');
    expect(subfolderNames).toContain('03 - Day 2 Robo-Wars (120fps Slow-Mo)');
    expect(subfolderNames).toContain('04 - Day 2 Star Night Concert (4K Master)');
    expect(subfolderNames).toContain('05 - Soundboard Audio Stems (WAV)');
  }, 30000);

  it('should auto-provision role-tailored personal drive for editor with Reel & Project subfolders', async () => {
    const drive = await DriveService.provisionPersonalUserDrive(editorUser);

    expect(drive.role).toBe('VIDEO_EDITOR');
    expect(drive.subfolders.length).toBe(5);

    const subfolderNames = drive.subfolders.map(s => s.name);
    expect(subfolderNames).toContain('01 - Day 1 Instagram Reels (9-16)');
    expect(subfolderNames).toContain('02 - Day 2 Instagram Reels (9-16)');
    expect(subfolderNames).toContain('03 - Official Festival Recap (16-9)');
    expect(subfolderNames).toContain('04 - Project Assets & SFX');
    expect(subfolderNames).toContain('05 - Exports for Review');
  }, 30000);

  it('should allow user to create, rename, and delete a custom subfolder in their personal drive', async () => {
    // 1. Create custom subfolder
    const newSub = await DriveService.addUserPersonalSubfolder(
      photographerUser,
      'Custom Drone Shots 100MB'
    );

    expect(newSub.name).toBe('Custom Drone Shots 100MB');
    expect(newSub.driveFolderId).toBeTruthy();
    expect(newSub.isDefault).toBe(false);

    // 2. Rename custom subfolder
    const renamed = await DriveService.renameUserPersonalSubfolder(
      photographerUser,
      newSub.driveFolderId,
      'Renamed Drone Shots 4K'
    );

    expect(renamed.name).toBe('Renamed Drone Shots 4K');
    expect(renamed.driveFolderId).toBe(newSub.driveFolderId);

    // 3. Delete custom subfolder
    const delResult = await DriveService.deleteUserPersonalSubfolder(
      photographerUser,
      newSub.driveFolderId
    );

    expect(delResult.success).toBe(true);
  });

  it('should resolve verified Google Drive folder IDs instantly without fake hashes', () => {
    const day1Photo = DriveService.resolveDestination('Day 1 - Morning', 'RAW_PHOTO');
    expect(day1Photo.driveFolderId).toBe('1tFGNR9WZo_9dGgf_6zBOHdBnpPRxBQXQ');
    expect(day1Photo.driveFolderUrl).toBe('https://drive.google.com/drive/folders/1tFGNR9WZo_9dGgf_6zBOHdBnpPRxBQXQ');

    const day1Video = DriveService.resolveDestination('Day 1', 'RAW_VIDEO');
    expect(day1Video.driveFolderId).toBe('1m7U0n1wuICACLVBmKl8YYLqEXvmVALWQ');

    const day2Photo = DriveService.resolveDestination('Day 2', 'RAW_PHOTO');
    expect(day2Photo.driveFolderId).toBe('1gLGhFYTYMwXxB3kmdrRN7ZE274nuZcI1');

    const day2Video = DriveService.resolveDestination('Day 2', 'RAW_VIDEO');
    expect(day2Video.driveFolderId).toBe('1LF1A9AbGiWyQlYKT0V0v7LH3OPCcBGUF');
  });
});
