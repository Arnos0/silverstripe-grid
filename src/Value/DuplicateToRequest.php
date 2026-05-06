<?php

declare(strict_types=1);

namespace WeDevelop\Grid\Value;

final readonly class DuplicateToRequest
{
    /**
     * @param positive-int $targetPageId
     * @param non-empty-string $targetZone
     */
    public function __construct(
        public NodeRef $element,
        public int $targetPageId,
        public string $targetZone,
        public NodeRef $targetParent,
    ) {
    }
}
