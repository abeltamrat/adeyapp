export interface CreateRoomDto {
  branchId: string;
  name: string;
  code: string;
  roomType?: string;
  capacity?: number;
  cleanupBufferMinutes?: number;
}
