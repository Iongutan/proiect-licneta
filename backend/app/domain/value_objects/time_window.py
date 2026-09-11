"""
OptiFleet B2B — Value Object: TimeWindow
==========================================
Fereastră temporală imutabilă cu validare și operații utile.
"""
from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timedelta

from app.core.exceptions import InvalidTimeWindowError


@dataclass(frozen=True)
class TimeWindow:
    """
    Interval de timp imutabil [start, end).

    Exemple:
        window = TimeWindow(
            start=datetime(2026, 9, 11, 8, 0),
            end=datetime(2026, 9, 11, 18, 0),
        )
        window.duration_hours  # 10.0
    """
    start: datetime
    end: datetime

    def __post_init__(self) -> None:
        if self.end <= self.start:
            raise InvalidTimeWindowError(
                f"end ({self.end}) must be after start ({self.start})"
            )

    @property
    def duration_hours(self) -> float:
        return (self.end - self.start).total_seconds() / 3600

    @property
    def duration_minutes(self) -> float:
        return (self.end - self.start).total_seconds() / 60

    def overlaps_with(self, other: TimeWindow) -> bool:
        """Verifică suprapunere cu altă fereastră temporală."""
        return self.start < other.end and self.end > other.start

    def contains(self, dt: datetime) -> bool:
        """Verifică dacă un moment e în fereastra curentă."""
        return self.start <= dt < self.end

    def expand(self, hours: float) -> TimeWindow:
        """Returnează o fereastră nouă mărită cu N ore în ambele direcții."""
        delta = timedelta(hours=hours)
        return TimeWindow(start=self.start - delta, end=self.end + delta)

    @classmethod
    def next_24h(cls) -> TimeWindow:
        """Fereastra: acum → +24 ore. Util pentru clustering imediat."""
        now = datetime.utcnow()
        return cls(start=now, end=now + timedelta(hours=24))
