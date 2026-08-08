import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('search')
  async search(@Query('q') q = '') {
    return this.usersService.searchPublicUsers(q);
  }

  @Get(':id')
  async profile(@Param('id') id: string) {
    return this.usersService.getPublicProfile(id);
  }

  @Get(':id/articles')
  async articles(@Param('id') id: string) {
    return this.usersService.getPublishedArticlesByAuthor(id);
  }
}
