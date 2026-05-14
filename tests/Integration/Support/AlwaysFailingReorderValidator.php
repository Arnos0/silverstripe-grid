<?php

declare(strict_types=1);

namespace WeDevelop\Grid\Tests\Integration\Support;

use Override;
use SilverStripe\Dev\TestOnly;
use SilverStripe\ORM\DataObject;
use WeDevelop\Grid\Contract\ReorderValidatorInterface;
use WeDevelop\Grid\Model\GridElement;
use WeDevelop\Grid\Value\Result;
use WeDevelop\Grid\Value\ValidationError;

/**
 * TestOnly {@see ReorderValidatorInterface} that always returns a failure
 * Result. Bound via Injector in a test to force {@see \WeDevelop\Grid\Service\ElementPlacementService::reorder()}
 * down its err path even when the natural failure triggers (missing sibling,
 * hierarchy violation) don't apply — used to pin transaction rollback for
 * the {@see \WeDevelop\Grid\Service\GridElementService::createElement()}
 * insertAtStart branch, where no afterElementID lookup can fail.
 */
final class AlwaysFailingReorderValidator implements ReorderValidatorInterface, TestOnly
{
    #[Override]
    public function validate(GridElement $element, DataObject $targetParent): Result
    {
        return Result::fail(new ValidationError(
            message: 'Forced placement failure for transaction-rollback testing.',
            field: 'parent',
            key: self::class . '.FORCED_FAIL',
        ));
    }
}
