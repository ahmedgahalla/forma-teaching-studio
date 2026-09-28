import copy
from unittest.mock import AsyncMock
import pytest
from fastapi.testclient import TestClient
import main
import scene_analysis as analysis
from test_scene_analysis import scene_request, explanation


def placed_request():
    payload = scene_request()
    payload['context']['appliances']['bracketPlacements'] = [
        {'tooth': '11', 'slotLocal': [0, .5, 3], 'referenceSlotLocal': [0, 0, 3], 'angleDeg': 5}
    ]
    return payload


def test_bracket_setup_facts_reach_read_only_provider_exactly(monkeypatch):
    monkeypatch.setenv('OPENAI_ANALYSIS_MODEL', 'interpreter-test')
    received = []
    provider = AsyncMock(side_effect=lambda payload, timeout: received.append(payload.model_dump(by_alias=True)) or explanation())
    monkeypatch.setattr(analysis, 'analyze_with_openai', provider)
    payload = placed_request()
    original = copy.deepcopy(payload)
    response = TestClient(main.app).post('/api/analyze-teaching', json=payload)
    assert response.status_code == 200, response.text
    assert payload == original and received == [original]
    assert response.json() == {**explanation(), 'model': 'interpreter-test'}


@pytest.mark.parametrize('field,value', [
    ('tooth', '12'), ('angleDeg', 10.1), ('angleDeg', True),
    ('slotLocal', [0, 0, 31]), ('referenceSlotLocal', [0, 3]),
])
def test_invalid_placement_facts_never_reach_provider(monkeypatch, field, value):
    provider = AsyncMock(return_value=explanation())
    monkeypatch.setattr(analysis, 'analyze_with_openai', provider)
    payload = placed_request()
    payload['context']['appliances']['bracketPlacements'][0][field] = value
    assert TestClient(main.app).post('/api/analyze-teaching', json=payload).status_code == 422
    provider.assert_not_called()


def test_duplicate_placement_facts_rejected(monkeypatch):
    provider = AsyncMock(return_value=explanation())
    monkeypatch.setattr(analysis, 'analyze_with_openai', provider)
    payload = placed_request()
    payload['context']['appliances']['bracketPlacements'] *= 2
    assert TestClient(main.app).post('/api/analyze-teaching', json=payload).status_code == 422
    provider.assert_not_called()
