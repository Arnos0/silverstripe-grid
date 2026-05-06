<?php

declare(strict_types=1);

namespace WeDevelop\Grid\Value;

final readonly class UpdateGridSettingsRequest
{
    /**
     * @param non-empty-string $viewport
     */
    public function __construct(
        public NodeRef $element,
        public string $viewport,
        public int $width,
        public int $offset,
        public bool $visible,
    ) {
    }
}
