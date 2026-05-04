interface EmptyStateProps {
  readonly message: string;
  readonly variant?: 'centered';
}

export default function EmptyState({ message, variant }: EmptyStateProps) {
  return (
    <div data-testid="empty-state" data-state={variant ?? undefined}>
      {message}
    </div>
  );
}
