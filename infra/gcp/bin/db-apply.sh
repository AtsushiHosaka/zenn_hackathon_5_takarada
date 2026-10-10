#!/usr/bin/env bash
# db/Schemafile を Cloud SQL に適用する (デプロイはしない)。
# いまジョブに設定されているイメージで走る。
exec "$(dirname "$0")/task.sh" furniture_texture:clear_legacy,db:apply
