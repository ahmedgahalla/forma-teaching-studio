import copy
import pytest
from pydantic import ValidationError
from mechanics import BracketPosition, Config, advance, as_dict
from test_mechanics import with_wire, post, wrap
from fastapi.testclient import TestClient
import main


def neutral():
    scene = with_wire()
    scene['mechanics']['config']['wires'][0]['expansionMm'] = 0
    return scene


@pytest.mark.parametrize('angle', [-10, 0, 10])
def test_bracket_angle_validated_and_serialized(angle):
    action = BracketPosition.model_validate({'type': 'bracket-position', 'tooth': '11', 'local': [0, 0, 3], 'angleDeg': angle})
    assert as_dict(action)['angleDeg'] == angle


@pytest.mark.parametrize('angle', [-10.1, 10.1, float('nan'), True, '5'])
def test_invalid_bracket_angle_rejected(angle):
    with pytest.raises(ValidationError):
        BracketPosition.model_validate({'type': 'bracket-position', 'tooth': '11', 'local': [0, 0, 3], 'angleDeg': angle})


def test_legacy_config_and_unknown_angle_reference():
    config = neutral()['mechanics']['config']
    assert 'bracketAngles' not in as_dict(Config.model_validate(config))
    with pytest.raises(ValidationError):
        Config.model_validate({**config, 'bracketAngles': {'12': 5}})


@pytest.mark.parametrize('local,angle', [([0, .5, 3], 0), ([0, 0, 3], 5)])
def test_bracket_edit_activates_only_connected_reference_wire(local, angle):
    scene = neutral()
    anchors = copy.deepcopy(scene['mechanics']['bracketAnchors'])
    advance(scene, {'type': 'bracket-position', 'tooth': '11', 'local': local, 'angleDeg': angle})
    advance(scene, {'type': 'solve'})
    assert scene['mechanics']['hasResult']
    assert scene['mechanics']['bracketAnchors'] == anchors
    scene['mechanics']['config']['wires'] = []
    with pytest.raises(ValueError):
        advance(scene, {'type': 'solve'})


def test_reset_and_remove_clear_angle_but_position_only_preserves_it():
    scene = neutral()
    advance(scene, {'type': 'bracket-position', 'tooth': '11', 'local': [0, 0, 3], 'angleDeg': 5})
    advance(scene, {'type': 'bracket-position', 'tooth': '11', 'local': [0, .3, 3]})
    assert scene['mechanics']['config']['bracketAngles'] == {'11': 5}
    advance(scene, {'type': 'bracket-position', 'tooth': '11', 'local': [0, 0, 3], 'angleDeg': 0})
    assert 'bracketAngles' not in scene['mechanics']['config']
    with pytest.raises(ValueError):
        advance(scene, {'type': 'solve'})
    scene['mechanics']['config']['wires'] = []
    advance(scene, {'type': 'bracket-position', 'tooth': '11', 'local': [0, 0, 3], 'angleDeg': 5})
    advance(scene, {'type': 'brackets', 'teeth': ['11'], 'installed': False})
    assert 'bracketAngles' not in scene['mechanics']['config']


def test_show_response_accepts_an_edited_bracket_context(monkeypatch):
    scene = neutral()
    scene['mechanics']['config']['bracketAngles'] = {'11': 5}
    response, provider = post(TestClient(main.app), monkeypatch, 'show what happens', wrap({'type': 'solve'}), scene)
    assert response.status_code == 200, response.text
    assert provider.call_args.args[0].context.mechanics.config.bracketAngles == {'11': 5}
