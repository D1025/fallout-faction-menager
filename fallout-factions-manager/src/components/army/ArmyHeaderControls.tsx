'use client';

import { Button } from 'antd';
import { ClearOutlined, FilterOutlined } from '@ant-design/icons';

export function ArmyHeaderControls({
    onOpenFiltersAction,
    onClearFiltersAction,
}: {
    onOpenFiltersAction: () => void;
    onClearFiltersAction: () => void;
}) {
    return (
        <div className="flex items-center gap-2">
            <Button
                size="small"
                icon={<FilterOutlined />}
                onClick={onOpenFiltersAction}
                aria-label="Filtry"
                title="Filtry"
            />
            <Button
                size="small"
                icon={<ClearOutlined />}
                onClick={onClearFiltersAction}
                aria-label="Wyczyść filtry"
                title="Wyczyść filtry"
            />
        </div>
    );
}

