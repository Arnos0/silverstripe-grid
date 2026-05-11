<?php

declare(strict_types=1);

namespace WeDevelop\Grid\Value;

final readonly class CreateElementRequest
{
    /**
     * @param positive-int|null $insertAfterElementID Place the new element directly after this sibling; null = append at the end
     * @param non-empty-string $zone
     * @param bool $insertAtStart Place the new element before all existing siblings. Mutually exclusive with $insertAfterElementID.
     */
    public function __construct(
        public ContainerType $containerType,
        public NodeRef $parent,
        public ?int $insertAfterElementID,
        public string $zone,
        public bool $insertAtStart = false,
    ) {
    }
}
