import type { AngelClient } from './client';
import type { GetProfileRes, UpdateProfileReq } from '@angel/protocol/rest';
import type { User } from '@angel/protocol/models';

export class ProfileApi {
  constructor(private c: AngelClient) {}

  async get(): Promise<User> {
    const r = await this.c.http<GetProfileRes>('/profile');
    return r.user;
  }

  async update(patch: UpdateProfileReq): Promise<void> {
    await this.c.http('/profile', {
      method: 'PATCH',
      body: JSON.stringify(patch)
    });
  }
}
