'use client';

import { Button } from 'antd';
import { FilterOutlined } from '@ant-design/icons';

export function ArmyHeaderControls({
    onOpenFiltersAction,
    hasActiveFilters,
}: {
    onOpenFiltersAction: () => void;
    hasActiveFilters: boolean;
}) {
    return (
        <div className="flex items-center gap-2">
            <Button
                type={hasActiveFilters ? 'primary' : 'default'}
                icon={<FilterOutlined />}
                onClick={onOpenFiltersAction}
                aria-label="Filtry"
                title="Filtry"
            />
        </div>
    );
}
