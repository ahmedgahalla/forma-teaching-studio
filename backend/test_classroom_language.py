import json
from pathlib import Path

import pytest

from classroom_language import normalize_classroom_language

FIXTURES = json.loads((Path(__file__).parents[1] / "src/lib/classroom-language.fixtures.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("source,expected", FIXTURES)
def test_shared_classroom_wording(source, expected):
    assert normalize_classroom_language(source) == expected
    assert normalize_classroom_language(expected) == expected


def test_never_changes_numeric_evidence():
    assert normalize_classroom_language("Could you move upper front teeth -0.5 mm and rotate them +3 degrees") == "move upper anterior teeth -0.5 mm and rotate them +3 degrees"
