export type TechExtractionReviewStatus = 'approve' | 'approve_edit' | 'reject';

export interface ReviewUserRef {
  email: string;
  fullName?: string | null;
}

export interface TechExtractionReview {
  id: string;
  candidateId: string;
  technicianId: string;
  action: TechExtractionReviewStatus;
  editedTitle?: string | null;
  editedProblemDescription?: string | null;
  editedSolution?: string | null;
  rejectReason?: string | null;
  createdAt: string;
  technician?: ReviewUserRef | null;
}

export interface KnowledgeExtractionCandidate {
  id: string;
  entryType?: string | null;
  title: string;
  problemDescription: string;
  solution: string;
  symptom?: string | null;
  rootCause?: string | null;
  tags: string | null;
  sourcePages?: string | null;
  confidence?: number | null;
  sectionType?: string | null;
  status: string;
  createdById: string;
  /** @deprecated use techReviews */
  techReviewStatus?: TechExtractionReviewStatus | null;
  techReviewedAt?: string | null;
  techEditedTitle?: string | null;
  techEditedProblemDescription?: string | null;
  techEditedSolution?: string | null;
  techRejectReason?: string | null;
  techReviewedBy?: ReviewUserRef | null;
  techReviews?: TechExtractionReview[];
  reviewedBy?: ReviewUserRef | null;
  reviewedById?: string | null;
}

export function reviewerDisplayName(u?: ReviewUserRef | null): string {
  if (!u) return 'Unknown';
  const n = u.fullName?.trim();
  return n && n.length > 0 ? n : u.email;
}

export function techReviewActionLabel(
  action: TechExtractionReviewStatus,
  technician?: ReviewUserRef | null,
): string {
  const name = reviewerDisplayName(technician);
  switch (action) {
    case 'approve':
      return `Approved by ${name}`;
    case 'approve_edit':
      return `Edited by ${name}`;
    case 'reject':
      return `Rejected by ${name}`;
    default:
      return name;
  }
}

export function techReviewLabel(review: TechExtractionReview): string {
  return techReviewActionLabel(review.action, review.technician);
}

export function candidateTechReviews(c: KnowledgeExtractionCandidate): TechExtractionReview[] {
  const list = c.techReviews ?? [];
  return [...list].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export function techReviewSummary(c: KnowledgeExtractionCandidate): string | null {
  const reviews = candidateTechReviews(c);
  if (reviews.length === 0) return null;
  const approve = reviews.filter((r) => r.action === 'approve').length;
  const edit = reviews.filter((r) => r.action === 'approve_edit').length;
  const reject = reviews.filter((r) => r.action === 'reject').length;
  const parts: string[] = [];
  if (approve) parts.push(`${approve} approve`);
  if (edit) parts.push(`${edit} edit`);
  if (reject) parts.push(`${reject} reject`);
  return parts.join(' · ');
}

export function findTechReviewByTechnician(
  c: KnowledgeExtractionCandidate,
  technicianId?: string | null,
): TechExtractionReview | null {
  if (!technicianId) return null;
  return candidateTechReviews(c).find((r) => r.technicianId === technicianId) ?? null;
}

export function adminFinalLabel(c: KnowledgeExtractionCandidate): string | null {
  if (c.status === 'approved' && c.reviewedBy) {
    return `Saved by ${reviewerDisplayName(c.reviewedBy)}`;
  }
  if (c.status === 'rejected' && c.reviewedBy) {
    return `Rejected by ${reviewerDisplayName(c.reviewedBy)}`;
  }
  return null;
}

/** Latest technician edit recommendation, if any. */
export function latestTechEditReview(c: KnowledgeExtractionCandidate): TechExtractionReview | null {
  const edits = candidateTechReviews(c).filter((r) => r.action === 'approve_edit');
  return edits.length > 0 ? edits[edits.length - 1]! : null;
}

/** Text admin should use when quick-approving (uses latest tech edit if present). */
export function adminApprovePayload(c: KnowledgeExtractionCandidate) {
  const edit = latestTechEditReview(c);
  if (edit) {
    return {
      title: edit.editedTitle ?? c.title,
      problemDescription: edit.editedProblemDescription ?? c.problemDescription,
      solution: edit.editedSolution ?? c.solution,
      tags: c.tags?.trim() || undefined,
    };
  }
  return {
    title: c.title,
    problemDescription: c.problemDescription,
    solution: c.solution,
    tags: c.tags?.trim() || undefined,
  };
}

export function techEditReviews(c: KnowledgeExtractionCandidate): TechExtractionReview[] {
  return candidateTechReviews(c).filter((r) => r.action === 'approve_edit');
}
