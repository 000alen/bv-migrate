"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, KeyRound } from "lucide-react";

interface ApiKeyFormProps {
  circleToken: string;
  anthropicKey: string;
  spaceGroupId: string;
  onCircleTokenChange: (v: string) => void;
  onAnthropicKeyChange: (v: string) => void;
  onSpaceGroupIdChange: (v: string) => void;
}

export function ApiKeyForm({
  circleToken,
  anthropicKey,
  spaceGroupId,
  onCircleTokenChange,
  onAnthropicKeyChange,
  onSpaceGroupIdChange,
}: ApiKeyFormProps) {
  const [saved, setSaved] = React.useState(false);

  function handleChange(
    key: string,
    value: string,
    setter: (v: string) => void
  ) {
    setter(value);
    if (typeof window !== "undefined") {
      localStorage.setItem(key, value);
    }
    setSaved(true);
    const t = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(t);
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4" />
          API Keys
          {saved && (
            <span className="ml-auto flex items-center gap-1 text-xs text-green-600 font-normal">
              <CheckCircle className="h-3 w-3" />
              Saved
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="circle-token">Circle API Token</Label>
          <Input
            id="circle-token"
            type="password"
            placeholder="circle_..."
            value={circleToken}
            onChange={(e) =>
              handleChange("bv_circle_token", e.target.value, onCircleTokenChange)
            }
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="anthropic-key">Anthropic API Key</Label>
          <Input
            id="anthropic-key"
            type="password"
            placeholder="sk-ant-..."
            value={anthropicKey}
            onChange={(e) =>
              handleChange(
                "bv_anthropic_key",
                e.target.value,
                onAnthropicKeyChange
              )
            }
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="space-group-id">Space Group ID</Label>
          <Input
            id="space-group-id"
            type="number"
            placeholder="12345"
            value={spaceGroupId}
            onChange={(e) =>
              handleChange(
                "bv_space_group_id",
                e.target.value,
                onSpaceGroupIdChange
              )
            }
            autoComplete="off"
          />
          <p className="text-xs text-black/50">
            Found in Circle community settings
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
