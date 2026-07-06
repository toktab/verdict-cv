package dev.toktab.brainhack.hiring;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

final class OffsetLimitPageable implements Pageable {
    private final int limit;
    private final long offset;
    private final Sort sort;

    OffsetLimitPageable(long offset, int limit, Sort sort) {
        if (offset < 0) {
            throw new IllegalArgumentException("Offset must be zero or greater");
        }
        if (limit < 1) {
            throw new IllegalArgumentException("Limit must be greater than zero");
        }
        this.offset = offset;
        this.limit = limit;
        this.sort = sort == null ? Sort.unsorted() : sort;
    }

    @Override
    public int getPageNumber() {
        return (int) (offset / limit);
    }

    @Override
    public int getPageSize() {
        return limit;
    }

    @Override
    public long getOffset() {
        return offset;
    }

    @Override
    public Sort getSort() {
        return sort;
    }

    @Override
    public Pageable next() {
        return new OffsetLimitPageable(offset + limit, limit, sort);
    }

    @Override
    public Pageable previousOrFirst() {
        if (offset <= limit) {
            return first();
        }
        return new OffsetLimitPageable(offset - limit, limit, sort);
    }

    @Override
    public Pageable first() {
        return new OffsetLimitPageable(0, limit, sort);
    }

    @Override
    public Pageable withPage(int pageNumber) {
        if (pageNumber < 0) {
            throw new IllegalArgumentException("Page number must be zero or greater");
        }
        return new OffsetLimitPageable((long) pageNumber * limit, limit, sort);
    }

    @Override
    public boolean hasPrevious() {
        return offset > 0;
    }
}
