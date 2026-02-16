'use client';

import { Flex, Input, Segmented } from 'antd';

export type FilterOption = { label: string; value: string };

export function FilterBar({
  search,
  onSearch,
  searchPlaceholder,
  options,
  value,
  onChange,
}: {
  search?: string;
  onSearch?: (next: string) => void;
  searchPlaceholder?: string;
  options?: FilterOption[];
  value?: string;
  onChange?: (next: string) => void;
}) {
  return (
    <Flex vertical gap={8}>
      {onSearch ? (
        <Input.Search
          allowClear
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={searchPlaceholder ?? 'Search'}
        />
      ) : null}
      {options?.length ? (
        <Segmented
          block
          options={options}
          value={value}
          onChange={(next) => onChange?.(String(next))}
        />
      ) : null}
    </Flex>
  );
}
