export type VideoTab = 'FRIEND' | 'FOR_YOU' | 'FOLLOWING';

export interface VideoCategory {
  _id: string;
  name: string;
  icon?: string;
}

export interface ReelComment {
  comment_id?: string;
  comment?: string;
  message?: string;
  commentedAt?: string;
  createdBy?: number;
  from?: number;
  parent_id?: string | null;
  parentId?: string | null;
  createdByFull?: any;
  expressions?: Array<{ expressedBy: number | string; expressedContent: string }>;
  userName?: string;
  firstName?: string;
}

export interface ReelVideo {
  id: string;
  momentId: string;
  attachmentUrl: string;
  description?: string;
  content?: string;
  userResponseMoment?: any;
  momentLikes?: Array<{ expressedBy: number | string; expressedContent?: string; expression?: string }>;
  momentComments?: ReelComment[];
  endorsements?: Array<{ userId: number | string }>;
  endorsementCount?: number;
  likedByMe?: boolean;
  error?: boolean;
}

export const REPORT_REASONS = ['Abuse', 'Harassment', 'Threat', 'Harmful to children', 'Pornography'];

/** Giữ nguyên giá trị BE customerfe (Interfaces.class.ts ERelationStatus). */
export enum ERelationStatus {
  BLOCKED = 'BLOCKED',
  FOLLOW = 'FOLLOW',
  FRIEND = 'FRIEND',
  UNFOLLOWED = 'UNFOLLOWED',
  FRIEND_REQUEST = 'FRIEND_REQUEST',
  FRIEND_AND_FOLLOW = 'FRIEND_AND_FOLLOW',
  FRIEND_AND_FOLLOW_REQUEST = 'FRIEND_AND_FOLLOW_REQUEST',
}
